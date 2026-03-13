#!/bin/bash
set -euo pipefail

# ── Config (edit these) ────────────────────────────────
REGISTRY="registry.gitlab.com/rny3/brande"
CLIENT_VM="brande@129.159.159.251"
CLIENT_VM_PATH="~/brande"
MAIN_VM="brande@129.159.134.3"
MAIN_VM_PATH="~/app"
# ───────────────────────────────────────────────────────

DRY_RUN=
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1
[ -n "$DRY_RUN" ] && echo "DRY RUN MODE"

[ -f .gitlab-ci.yml ] || { echo "Run from repo root"; exit 1; }

# ── Pre-flight checks ──
BRANCH=$(git branch --show-current)
[ "$BRANCH" = "dev" ] || { echo "Not on dev (on $BRANCH)"; exit 1; }

git diff --quiet && git diff --cached --quiet \
  || { echo "Uncommitted changes"; exit 1; }

git fetch origin dev --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/dev)
[ "$LOCAL" = "$REMOTE" ] \
  || { echo "dev not in sync with origin/dev"; exit 1; }

# ── Detect changed services since last deploy ──
LAST_TAG=$(git tag -l 'deploy-*' --sort=-creatordate | head -1)
HASH=$(git rev-parse --short HEAD)

if [ -n "$LAST_TAG" ]; then
  echo "Last deploy: $LAST_TAG"
  mapfile -t SERVICES < <(
    git diff --name-only "$LAST_TAG" HEAD -- services/ \
      | cut -d/ -f2 | sort -u
  )
else
  echo "No previous deploy tag — building all services"
  mapfile -t SERVICES < <(
    printf '%s\n' services/*/Dockerfile | cut -d/ -f2
  )
fi

# ── Build and push changed services ──
if [ ${#SERVICES[@]} -gt 0 ]; then
  echo "Services to build: ${SERVICES[*]}"
  if [ -z "$DRY_RUN" ]; then
    for SVC in "${SERVICES[@]}"; do
      [ -f "services/$SVC/Dockerfile" ] || continue
      echo "-- $SVC --"
      docker build --target production \
        -t "$REGISTRY/$SVC:latest" \
        -t "$REGISTRY/$SVC:$HASH" \
        "services/$SVC/"
      docker push "$REGISTRY/$SVC:latest"
      docker push "$REGISTRY/$SVC:$HASH"
    done
  fi
else
  echo "No service changes to build"
fi

# ── Pull client data (edited by admin at runtime) ──
for DIR in prod_setup/client_server/*/data; do
  [ -d "$DIR" ] || continue
  CLIENT=$(basename "$(dirname "$DIR")")
  echo "-- Pulling data: $CLIENT --"
  rsync -avz ${DRY_RUN:+--dry-run} \
    "$CLIENT_VM:$CLIENT_VM_PATH/$CLIENT/data/" "$DIR/"
done

# ── Generate service-aware compose/Caddyfile per client ──
for DIR in prod_setup/client_server/*/data; do
  [ -d "$DIR" ] || continue
  CLIENT_DIR=$(dirname "$DIR")
  CLIENT=$(basename "$CLIENT_DIR")
  [ "$CLIENT" = "router" ] || [ "$CLIENT" = "shared" ] && continue
  SVC_FILE="$DIR/services.json"
  [ -f "$SVC_FILE" ] || continue

  echo "-- Regenerating compose/Caddyfile: $CLIENT --"
  node -e "
    const fs = require('fs')
    const svc = JSON.parse(fs.readFileSync('$SVC_FILE', 'utf-8'))
    const REG = '$REGISTRY'
    const base = '$CLIENT_DIR'

    // Regenerate gateway/Caddyfile
    let caddyfile = ':80 {\n'
    caddyfile += '\thandle_path /admin/* {\n\t\treverse_proxy admin:9876 {\n\t\t\theader_up X-Forwarded-Proto {header.X-Forwarded-Proto}\n\t\t}\n\t}\n\n'
    caddyfile += '\thandle /site/* {\n\t\turi strip_prefix /site\n\t\treverse_proxy prompt-composer:4321\n\t}\n\n'
    if (svc['facebook-dm']) caddyfile += '\thandle_path /facebook/dm {\n\t\treverse_proxy facebook-dm:3210\n\t}\n\n'
    if (svc['facebook-comments']) caddyfile += '\thandle_path /facebook/comments {\n\t\treverse_proxy facebook-comments:3210\n\t}\n\n'
    if (svc['mock-facebook']) caddyfile += '\thandle_path /mock-facebook/* {\n\t\treverse_proxy mock-facebook:3210\n\t}\n\n'
    if (svc.site) caddyfile += '\thandle {\n\t\treverse_proxy site:80\n\t}\n'
    caddyfile += '}\n'
    fs.writeFileSync(base + '/gateway/Caddyfile', caddyfile)

    // Regenerate docker-compose.yml
    let compose = 'services:\n\n'
    compose += '  gateway:\n    image: caddy:2.10.2-alpine\n    networks: [client_network, qabu_network]\n    volumes: [./gateway/Caddyfile:/etc/caddy/Caddyfile:ro]\n\n'
    if (svc.site) compose += '  site:\n    image: ' + REG + '/site:latest\n    networks: [client_network]\n    volumes:\n      - ./assets:/site/assets\n      - ../shared/widget/widget.js:/site/widget.js:ro\n\n'
    compose += '  prompt-composer:\n    image: ' + REG + '/prompt_composer:latest\n    networks: [client_network]\n    secrets: [gemini_1, gemini_2, groq_1, groq_2]\n    volumes: [./data/:/app/data]\n\n'
    compose += '  admin:\n    image: ' + REG + '/admin:latest\n    networks: [client_network]\n    secrets: [authorized_emails]\n    volumes:\n      - ./assets:/app/assets:ro\n      - ../shared/widget/widget.js:/app/public/widget.js:ro\n\n'
    if (svc['mock-facebook']) compose += '  mock-facebook:\n    image: ' + REG + '/mock_facebook:latest\n    networks: [client_network]\n    volumes: [./assets/mock_facebook/:/app/data/]\n\n'
    if (svc['facebook-comments']) compose += '  facebook-comments:\n    image: ' + REG + '/facebook_comments:latest\n    networks: [client_network]\n    secrets: [fb_page_access_token]\n    environment: [FACEBOOK_API_URL=https://graph.facebook.com/v24.0/]\n\n'
    if (svc['facebook-dm']) compose += '  facebook-dm:\n    image: ' + REG + '/facebook_dm:latest\n    networks: [client_network]\n    secrets: [fb_page_access_token]\n    environment: [FACEBOOK_API_URL=https://graph.facebook.com/v24.0/]\n\n'

    compose += 'networks:\n  client_network:\n  qabu_network: {external: true}\n\n'
    compose += 'secrets:\n  authorized_emails: {file: ./secrets/authorized_emails.json}\n'
    compose += '  gemini_1:          {file: ./secrets/gemini_1.secret}\n'
    compose += '  gemini_2:          {file: ./secrets/gemini_2.secret}\n'
    compose += '  groq_1:            {file: ./secrets/groq_1.secret}\n'
    compose += '  groq_2:            {file: ./secrets/groq_2.secret}\n'
    const needsFb = svc['facebook-comments'] || svc['facebook-dm']
    if (needsFb) compose += '  fb_page_access_token: {file: ./secrets/fb_page_access_token.secret}\n'
    fs.writeFileSync(base + '/docker-compose.yml', compose)
  "
done

# ── Sync prod directories ──
echo "-- Syncing client server --"
rsync -avz --delete ${DRY_RUN:+--dry-run} \
  prod_setup/client_server/ "$CLIENT_VM:$CLIENT_VM_PATH/"
echo "-- Syncing main server --"
rsync -avz --delete ${DRY_RUN:+--dry-run} \
  prod_setup/main_server/ "$MAIN_VM:$MAIN_VM_PATH/"

# ── Pull and restart ──
if [ -z "$DRY_RUN" ]; then
  for DIR in prod_setup/client_server/*/; do
    NAME=$(basename "$DIR")
    [ "$NAME" = "router" ] || [ "$NAME" = "shared" ] && continue
    echo "-- $NAME: pull + up --"
    ssh "$CLIENT_VM" \
      "cd $CLIENT_VM_PATH/$NAME && docker compose pull && docker compose up -d"
  done
  echo "-- main server: pull + up --"
  ssh "$MAIN_VM" \
    "cd $MAIN_VM_PATH && docker compose pull && docker compose up -d"
else
  echo "Would pull + up on client VM: $(
    printf '%s ' prod_setup/client_server/*/  \
      | xargs -n1 basename | tr '\n' ' '
  )"
  echo "Would pull + up on main VM"
fi

# ── Commit pulled data if changed ──
if git diff --quiet -- '*/data/'; then
  echo "No data changes from production"
else
  if [ -z "$DRY_RUN" ]; then
    git add '*/data/'
    git commit -m "sync production data"
    git push origin dev
    HASH=$(git rev-parse --short HEAD)
  else
    echo "Would commit synced production data"
  fi
fi

# ── Create deploy tag ──
BASE="deploy-$(date +%Y-%m-%d)"
TAG=$BASE
N=2
while git rev-parse "$TAG" >/dev/null 2>&1; do
  TAG="$BASE.$N"
  N=$((N + 1))
done

if [ -z "$DRY_RUN" ]; then
  git tag "$TAG"
  git push origin "$TAG"
  echo "Deployed $TAG ($HASH)"
else
  echo "Would tag: $TAG ($HASH)"
fi

#!/bin/bash
set -euo pipefail

# ── Config (edit these) ────────────────────────────────
REGISTRY="registry.gitlab.com/rny3/brande"
CLIENT_VM="brande@129.159.159.251"
CLIENT_VM_PATH="~/brande"
MAIN_VM="brande@129.159.134.3"
MAIN_VM_PATH="~/main"
# ───────────────────────────────────────────────────────

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true
[ "$DRY_RUN" = true ] && echo "DRY RUN MODE"

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
  if [ "$DRY_RUN" = false ]; then
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

# ── Sync prod directories ──
echo "-- Syncing client server --"
rsync -avz ${DRY_RUN:+--dry-run} \
  prod_setup/client_server/ "$CLIENT_VM:$CLIENT_VM_PATH/"
echo "-- Syncing main server --"
rsync -avz ${DRY_RUN:+--dry-run} \
  prod_setup/main_server/ "$MAIN_VM:$MAIN_VM_PATH/"

# ── Pull and restart ──
if [ "$DRY_RUN" = false ]; then
  for DIR in prod_setup/client_server/*/; do
    NAME=$(basename "$DIR")
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
  if [ "$DRY_RUN" = false ]; then
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

if [ "$DRY_RUN" = false ]; then
  git tag "$TAG"
  git push origin "$TAG"
  echo "Deployed $TAG ($HASH)"
else
  echo "Would tag: $TAG ($HASH)"
fi

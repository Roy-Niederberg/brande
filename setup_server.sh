#!/usr/bin/env bash
# setup_server.sh — base host setup for a new Qabu VM (Oracle). Role-neutral:
# run it for any VM, then (for a client VM) ./setup_clients_router.sh — the
# final banner walks you through what's next.
#
# What it does: creates the `brande` user, makes ufw the sole firewall owner
# (22/80/443, purging Oracle's stock iptables — note OCI's Security List is a
# SECOND, separate layer), installs Docker, installs the qabu-reconciler
# systemd service (converges ~/clients/*/docker-compose.yml with the running
# containers), prompts for a GitLab deploy token for the registry docker
# login (create one token PER VM, named after it, scope read_registry — so a
# retired/compromised VM can be revoked alone), and clones the clients repo
# (blobless, cone-sparse: root files only) after pausing while you add its
# generated SSH key to GitLab as a deploy key (name it after the VM too).
#
# Run from your dev machine against a FRESH Ubuntu 24.04 box you can SSH into
# as the default cloud user (passwordless sudo; it stays as break-glass):
#
#   ./setup_server.sh ubuntu@129.159.154.37
#
# Idempotent — safe to re-run (re-runs redeploy the reconciler, skip what
# exists; the sudo-password prompt reappears — re-enter the same one).
set -euo pipefail

TARGET="${1:?usage: setup_server.sh <cloud-user>@<host>  e.g. ubuntu@1.2.3.4}"
USER_NAME=brande

# --- host prep (runs as root on the VM; vars expand remotely) -----------------
ssh "$TARGET" 'sudo bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive   # no tty over `bash -s` — use defaults, no debconf noise
USER_NAME=brande

echo "== OS =="
. /etc/os-release; echo "  $PRETTY_NAME ($(uname -m))"
[ "$VERSION_ID" = "24.04" ] || echo "  WARN: expected 24.04 — upgrade first (do-release-upgrade in tmux)"

echo "== user: $USER_NAME =="
id "$USER_NAME" &>/dev/null && echo "  exists" || adduser --disabled-password --gecos "" "$USER_NAME"
usermod -aG sudo "$USER_NAME"                      # sudo group => sudo asks for a password
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
KEY="/home/${SUDO_USER:?run via sudo}/.ssh/authorized_keys"   # reuse the key you logged in with
if [ -f "$KEY" ]; then
  install -m 600 -o "$USER_NAME" -g "$USER_NAME" "$KEY" "/home/$USER_NAME/.ssh/authorized_keys"
else
  echo "  WARN: $KEY not found — add $USER_NAME's SSH key manually"
fi

echo "== git ssh key =="
GIT_KEY="/home/$USER_NAME/.ssh/id_ed25519"
if [ -f "$GIT_KEY" ]; then echo "  exists"; else
  sudo -u "$USER_NAME" ssh-keygen -t ed25519 -N "" -C "$USER_NAME@$(hostname)" -f "$GIT_KEY" >/dev/null
fi

echo "== firewall: ufw (sole owner) =="
echo "This might take few minutes..."
apt-get purge -y iptables-persistent netfilter-persistent >/dev/null 2>&1 || true  # drop Oracle's boot rules
apt-get install -y ufw >/dev/null
for p in OpenSSH 80/tcp 443/tcp; do ufw allow "$p" >/dev/null; done
ufw --force enable
ufw status verbose

echo "== docker =="
command -v docker &>/dev/null && echo "  $(docker --version)" || curl -fsSL https://get.docker.com | sh
usermod -aG docker "$USER_NAME"

echo "== git =="
command -v git &>/dev/null && echo "  $(git --version)" || apt-get install -y git >/dev/null

echo "== reconciler =="
# Operational notes (replaces the old conductor):
# - No `docker compose pull` in the loop: deploys stay explicit (pull on the
#   VM, or bump the image tag). `up` still fetches images it doesn't have
#   locally, so brand-new stacks start fine.
# - Race window: events landing during a sweep (a few seconds) are missed
#   until the next event — `sudo systemctl restart qabu-reconciler` forces one.
# - Watch/debug: journalctl -fu qabu-reconciler
# - The ORIGINAL client VM (129.159.159.251) predates this layout: its unit
#   was hand-installed with WorkingDirectory=/home/brande/app/clients.
apt-get install -y entr >/dev/null
install -d -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/clients"
cat > /usr/local/bin/qabu-reconciler <<'RECONCILER'
#!/bin/sh
# qabu-reconciler — converge running containers with */docker-compose.yml under
# the working directory. Sleeps in inotify (via entr) until a compose file
# changes or a directory entry appears — no polling. Deleting a compose file
# does NOT take its stack down; removing a client stays a manual act.
sweep() {
  for f in */docker-compose.yml; do
    [ -f "$f" ] || continue
    echo "converge: ${f%/*}"
    docker compose --project-directory "${f%/*}" up -d --remove-orphans
  done
}
sweep
while :; do
  { echo .; ls -d -- */ 2>/dev/null; ls -- */docker-compose.yml 2>/dev/null; } \
    | entr -dnpz true
  sweep
  sleep 1
done
RECONCILER
chmod 755 /usr/local/bin/qabu-reconciler
cat > /etc/systemd/system/qabu-reconciler.service <<UNIT
[Unit]
Description=Qabu reconciler — converge client docker-compose stacks on change
After=docker.service
Requires=docker.service

[Service]
User=$USER_NAME
WorkingDirectory=/home/$USER_NAME/clients
ExecStart=/usr/local/bin/qabu-reconciler
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable qabu-reconciler >/dev/null 2>&1
systemctl restart qabu-reconciler
echo "  qabu-reconciler: $(systemctl is-active qabu-reconciler), watching /home/$USER_NAME/clients"
echo "== host done =="
REMOTE

# --- set the sudo password interactively (never touches this script) ----------
echo; echo "Set the sudo password for $USER_NAME:"
ssh -t "$TARGET" "sudo passwd $USER_NAME"

# --- registry login: lets `docker compose pull/up` fetch images as $USER_NAME --
registry_login() {
  local user token
  read -rp  "  deploy-token username: " user
  read -rsp "  deploy token (gldt-...): " token; echo
  printf %s "$token" | ssh "$TARGET" \
    "sudo -iu $USER_NAME docker login registry.gitlab.com --username '$user' --password-stdin"
}
echo
if ssh "$TARGET" "sudo -iu $USER_NAME grep -qs registry.gitlab.com /home/$USER_NAME/.docker/config.json"; then
  echo "GitLab registry: already logged in"
else
  echo "GitLab registry login (for pulling docker images) — create a deploy token per VM, named after it"
  echo "(GitLab: Project → Settings → Repository → Deploy tokens, scope read_registry):"
  until registry_login; do echo "  login failed — check the token and try again"; done
fi

echo; echo "SSH public key (for client data backups)  — add to GitLab as a deploy key (Project → Settings →"
echo "Repository → Deploy keys; tick 'Grant write permissions' so it can push):"
ssh "$TARGET" "sudo cat /home/$USER_NAME/.ssh/id_ed25519.pub"

# --- clone the repo: no checkout, no blobs — ready for sparse-checkout later --
clone_repo() {
  ssh "$TARGET" "sudo -iu $USER_NAME bash -s" <<'REMOTE'
set -euo pipefail
echo "== clone qabunet/clients (sparse: root files only, no blobs) =="
if [ -d clients/.git ]; then echo "  exists"; else
  GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' \
    git clone --no-checkout --filter=blob:none git@gitlab.com:qabunet/clients.git
fi
cd clients
# Cone sparse-checkout, no dirs: materializes only root files (.gitignore —
# which guards future backup commits — README). Client dirs from OTHER VMs must
# never materialize here: the reconciler would docker-compose them all up.
# This VM's roster = `git sparse-checkout add <client>` per migrated client.
git sparse-checkout set
git checkout main
REMOTE
}
echo
read -rp "Add the key to GitLab, then press Enter to clone the repo on the VM... "
until clone_repo; do
  read -rp "Clone failed — check the deploy key in GitLab, then press Enter to retry... "
done

cat <<EOF

Base setup complete on $TARGET.
  - $USER_NAME must re-login before the docker group takes effect.
  - aarch64 box? services need linux/arm64 images (services/build.sh pushes multi-arch).
  - Reconciler is live: journalctl -fu qabu-reconciler

If this is a CLIENT server, now run:
  ./setup_clients_router.sh $USER_NAME@${TARGET#*@}
It deploys the clients-router stack, then walks you through Cloudflare DNS
(v{N}.qabu.net) + OCI Security List ingress (TCP 80+443, console) and verifies both.

If this is the MAIN server, those two stay manual (OCI ingress 80+443, DNS),
then deploy ~/app per CLAUDE.md § Building & Deploying.
EOF

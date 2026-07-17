#!/usr/bin/env bash
# setup_server.sh — base host setup for a new Qabu VM (Oracle).
# Creates the `brande` user, sets up the ufw firewall, installs Docker, installs
# the qabu-reconciler systemd service (converges ~/clients/*/docker-compose.yml
# with the running containers), and clones the repo (blobless, no checkout)
# after you add its SSH key to GitLab.
# Run from your dev machine against a FRESH Ubuntu 24.04 box you can SSH into as
# the default cloud user (which has passwordless sudo).
#
#   ./setup_server.sh ubuntu@129.159.154.37
#
# Idempotent — safe to re-run (re-running also redeploys the reconciler script).
# Does NOT do role setup (registry login, clients-router) — see
# docs/client-server-setup.md steps 1-8 for that.
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

echo; echo "SSH public key — add to GitLab as a deploy key (Project → Settings →"
echo "Repository → Deploy keys; tick 'Grant write permissions' so it can push):"
ssh "$TARGET" "sudo cat /home/$USER_NAME/.ssh/id_ed25519.pub"

# --- clone the repo: no checkout, no blobs — ready for sparse-checkout later --
clone_repo() {
  ssh "$TARGET" "sudo -iu $USER_NAME bash -s" <<'REMOTE'
set -euo pipefail
echo "== clone qabunet/clients (no checkout, no blobs) =="
if [ -d clients/.git ]; then echo "  exists"; else
  GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' \
    git clone --no-checkout --filter=blob:none git@gitlab.com:qabunet/clients.git
fi
REMOTE
}
echo
read -rp "Add the key to GitLab, then press Enter to clone the repo on the VM... "
until clone_repo; do
  read -rp "Clone failed — check the deploy key in GitLab, then press Enter to retry... "
done

cat <<EOF

Base setup complete on $TARGET. Still manual:
  - OCI Security List: open ingress TCP 80 + 443 for the subnet (console).
  - $USER_NAME must re-login before the docker group takes effect.
  - aarch64 box? services need linux/arm64 images.
  - Role setup (registry login, clients-router): docs/client-server-setup.md.
  - Reconciler is live: journalctl -fu qabu-reconciler
EOF

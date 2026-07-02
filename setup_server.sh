#!/usr/bin/env bash
# setup_server.sh — base host setup for a new Qabu VM (Oracle).
# Creates the `brande` user, sets up the ufw firewall, and installs Docker.
# Run from your dev machine against a FRESH Ubuntu 24.04 box you can SSH into as
# the default cloud user (which has passwordless sudo).
#
#   ./setup_server.sh ubuntu@129.159.154.37
#
# Idempotent — safe to re-run. Does NOT do role setup (registry login, conductor,
# clients-router) — see docs/client-server-setup.md steps 1-8 for that.
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
echo "== host done =="
REMOTE

# --- set the sudo password interactively (never touches this script) ----------
echo; echo "Set the sudo password for $USER_NAME:"
ssh -t "$TARGET" "sudo passwd $USER_NAME"

cat <<EOF

Base setup complete on $TARGET. Still manual:
  - OCI Security List: open ingress TCP 80 + 443 for the subnet (console).
  - $USER_NAME must re-login before the docker group takes effect.
  - aarch64 box? services need linux/arm64 images.
  - Role setup (registry login, conductor, clients-router): docs/client-server-setup.md.
EOF

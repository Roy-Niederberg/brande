# Client Server Setup

How to provision a new Qabu client VM from scratch on Oracle Cloud.

## Prerequisites

- Oracle Cloud VM running Ubuntu (24.04 LTS)
- SSH key access from your dev machine (the default `ubuntu`/`opc` user is fine —
  the `brande` user is created in step 0)
- GitLab personal access token (for pulling Docker images)
- Cloudflare API token (for wildcard TLS)
- Secrets ready: `jwt_signing_key`, `fb_dispatcher_secret`, `provision_secret`,
  `cloudflare_api_token` (must match main server)

## 0. Base OS & firewall — `setup_server.sh`

From your dev machine, against a fresh Ubuntu 24.04 box you can SSH into as the
default cloud user (`ubuntu`, which has passwordless sudo):

```sh
./setup_server.sh ubuntu@<vm-ip>
```

It's idempotent (safe to re-run) and does the whole host baseline. What it does:

- **OS check** — warns if not 24.04 (won't auto-upgrade; see note below).
- **`brande` user** — created with password-protected sudo. The default `ubuntu`
  user has *passwordless* sudo; we want a real password prompt, so `brande` goes
  in the `sudo` group. You're prompted for the password at the very end over an
  interactive `ssh -t`, so it never touches the script/args/history. The user is
  also added to the `docker` group and gets the SSH key you logged in with (copied
  from the cloud user's `authorized_keys`, via `$SUDO_USER` — not root's, which on
  Oracle images is a decoy "log in as ubuntu" message).
- **Firewall — `ufw` as sole owner.** Oracle images ship a stock iptables ruleset
  (loaded at boot by `iptables-persistent`) that `REJECT`s everything but 22. The
  script purges `iptables-persistent`/`netfilter-persistent` and lets ufw manage
  the host, allowing 22/80/443 on both IPv4 and IPv6.
- **Docker** — installs Docker CE (arm64/amd64 auto-detected by get.docker.com).

After it runs, `brande` must re-login before the docker group takes effect.

Caveat — **Docker bypasses ufw.** Published container ports (`-p`) punch through
ufw via the FORWARD/DNAT path, so a `-p 0.0.0.0:PORT` is reachable even if ufw
doesn't list it. Fine for Caddy's 80/443 (we *want* those public); just don't rely
on ufw to hide a published port — bind internal-only ports to `127.0.0.1`.

### Still manual (the script can't / shouldn't do these)

- **OCI Security List (cloud firewall).** ufw is only the host layer; OCI's network
  layer also gates 80/443. Console: **Networking → VCN → Security Lists → Default →
  Add Ingress Rules** for TCP 80 + 443, source `0.0.0.0/0`, stateful. It attaches
  to the *subnet*, so a VM added to a subnet that already serves web traffic
  **inherits** the rules — confirm with a curl from outside the cloud:
  **"connection refused"** = both firewalls open (nothing listening yet, which is
  fine); **timeout** = a firewall is still blocking, go add the ingress rule.
  (The two ARM VMs landed in the AMD VMs' subnet and inherited 80/443 — no console
  change was needed.)
- **OS upgrade.** If the box isn't on 24.04, upgrade in place with
  `sudo do-release-upgrade` **inside `tmux`/`screen`** (a dropped SSH session
  mid-upgrade can brick it; it also parks at interactive prompts — reattach to
  answer them). The OCI console keeps showing the *original* image version
  afterward — cosmetic, ignore it.

The default `ubuntu` user is left in place as a **break-glass** account (key-only
SSH, passwordless sudo). On a key-only box it's not a meaningful risk, and it's
your way back in if `brande` ever breaks — don't delete it. Lock it if you want it
inert: `sudo usermod -L -s /usr/sbin/nologin ubuntu`.

## 1. Install Docker

Already done by `setup_server.sh` (step 0) — it installs Docker CE and adds
`brande` to the `docker` group. Only needed if you set the box up by hand:

```sh
ssh brande@<vm>
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker brande
exit  # re-login for group to take effect
```

## 2. Log in to GitLab registry

```sh
ssh brande@<vm> 'docker login registry.gitlab.com'
# Username: your GitLab username
# Password: personal access token with read_registry scope
```

## 3. Create directory structure

```sh
ssh brande@<vm> 'mkdir -p ~/app'
```

The secrets dir is created by rsync (step 5). The conductor creates
`~/app/clients/` on startup. The config service creates `~/app/config/`
when it runs.

Expected layout when done:

```
~/app/
  conductor                         # binary (step 4)
  docker-compose.yml                # clients-router + config service (step 5)
  secrets/
    cloudflare_api_token.secret
    fb_dispatcher_secret.secret
    jwt_signing_key.secret
    provision_secret.secret
  config/                           # created by config service — this IS the client template
    docker-compose.yml
    assets/
    data/
  clients/                          # created by conductor
    <subdomain>/
      docker-compose.yml
      assets/
      data/
      secrets/
```

## 4. Build and deploy conductor

From repo root on your dev machine:

```sh
# Compile static binary (~650KB, no runtime dependencies)
docker run --rm \
  -v $(pwd)/clients_server_automation/conductor/src:/src \
  -w /src gcc:latest \
  g++ -std=c++20 -O2 -static -s -o /src/conductor main.cpp

# Copy binary to server
scp clients_server_automation/conductor/src/conductor brande@<vm>:~/app/conductor

# Install systemd service
scp clients_server_automation/conductor/qabu-conductor.service brande@<vm>:/tmp/
ssh brande@<vm> 'sudo cp /tmp/qabu-conductor.service /etc/systemd/system/ \
  && sudo systemctl daemon-reload \
  && sudo systemctl enable --now qabu-conductor'

# Verify
ssh brande@<vm> 'journalctl -fu qabu-conductor'
# Should see: [conductor] watching /home/brande/app/clients
```

The systemd service uses `RuntimeDirectory=qabu` to create `/run/qabu/` (owned
by `brande`) before the conductor starts. The conductor creates its Unix socket there.

## 5. Deploy clients-router

Copy the compose file and secrets:

```sh
scp prod/client-server-clients-router-docker-compose.yml brande@<vm>:~/app/docker-compose.yml

# Sync secrets (must match main server values)
# Your local secrets dir should contain:
#   cloudflare_api_token.secret
#   fb_dispatcher_secret.secret
#   jwt_signing_key.secret
#   provision_secret.secret
rsync -av <your-secrets-dir>/ brande@<vm>:~/app/secrets/
```

Start it (this also creates the `qabu_network` Docker network and runs
the config service which populates `~/app/config/`):

```sh
ssh brande@<vm> 'cd ~/app && docker compose up -d'
```

Verify:

```sh
ssh brande@<vm> 'cd ~/app && docker compose ps'
ssh brande@<vm> 'docker network ls | grep qabu'
ssh brande@<vm> 'ls ~/app/config/docker-compose.yml'
```

## 6. DNS

Add a record for the provisioner endpoint in Cloudflare:

| Type | Name          | Value     | Proxy |
|------|---------------|-----------|-------|
| A    | `vN.qabu.net` | `<vm-ip>` | Off   |

`vN` is the VM number (`v1` for the first client VM, `v2` for the second, etc.).
The onboarding service tries `v1`, `v2`, ... until one accepts the client.

Each client also needs an A record pointing to its VM:

| Type | Name                    | Value     | Proxy |
|------|-------------------------|-----------|-------|
| A    | `<subdomain>.qabu.net`  | `<vm-ip>` | Off   |

Currently these are created manually in Cloudflare per client.

## 8. Verify the full stack

```sh
# Conductor is running and watching
ssh brande@<vm> 'systemctl status qabu-conductor'

# Socket exists
ssh brande@<vm> 'ls -la /run/qabu/conductor.sock'

# Clients-router is up
ssh brande@<vm> 'cd ~/app && docker compose ps'

# Network exists
ssh brande@<vm> 'docker network inspect qabu_network --format "{{.Name}}"'
```

## Updating services

After building and pushing a new image to the registry:

```sh
# Update a specific client's stack
ssh brande@<vm> 'cd ~/app/clients/<subdomain> && docker compose pull && docker compose up -d'

# Update clients-router
ssh brande@<vm> 'cd ~/app && docker compose pull && docker compose up -d'
```

Or trigger a conductor restart by touching the compose file:

```sh
ssh brande@<vm> 'touch ~/app/clients/<subdomain>/docker-compose.yml'
# Conductor detects the change and runs: docker compose pull && up -d
```

## Updating conductor

```sh
# Rebuild (from repo root)
docker run --rm \
  -v $(pwd)/clients_server_automation/conductor/src:/src \
  -w /src gcc:latest \
  g++ -std=c++20 -O2 -static -s -o /src/conductor main.cpp

# Deploy
scp clients_server_automation/conductor/src/conductor brande@<vm>:~/app/conductor
ssh brande@<vm> 'sudo systemctl restart qabu-conductor'
```

## Shared secrets reference

These secrets must be identical across the main server and all client VMs:

| Secret                 | Used by                                    |
|------------------------|--------------------------------------------|
| `jwt_signing_key`      | Auth (main) + auth-verifier (client)       |
| `fb_dispatcher_secret` | Facebook dispatcher (main) + clients-router|
| `provision_secret`     | Onboarding (main) + provisioner (client)   |
| `cloudflare_api_token` | TLS on both VMs                            |

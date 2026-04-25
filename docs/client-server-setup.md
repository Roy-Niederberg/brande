# Client Server Setup

How to provision a new Qabu client VM from scratch on Oracle Cloud.

## Prerequisites

- Oracle Cloud VM running Ubuntu (22.04+)
- SSH key access from your dev machine
- A `brande` user on the VM
- GitLab personal access token (for pulling Docker images)
- Cloudflare API token (for wildcard TLS)
- Secrets ready: `jwt_signing_key`, `fb_dispatcher_secret`, `provision_secret`,
  `cloudflare_api_token` (must match main server)

## 1. Install Docker

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

# Conductor

Host systemd daemon that manages the full lifecycle of Qabu client services.

**Responsibilities:**
- Watches each client's `docker-compose.yml` via inotify — restarts the stack on change
- Reconciles desired vs actual state every 60s: every client dir with a compose file should have a running stack
- Handles client creation requests from the provisioner via Unix socket

## Tests

```sh
cd services/conductor/test && docker compose up --abort-on-container-exit
```

## Build & deploy

From the repo root, compile a static binary locally (no compiler needed on the server):

```sh
# Compile — static + stripped, ~650KB, no runtime dependencies
docker run --rm \
  -v $(pwd)/clients_server_automation/conductor/src:/src \
  -w /src gcc:latest \
  g++ -std=c++20 -O2 -static -s -o /src/conductor main.cpp

# Copy to server and restart
scp clients_server_automation/conductor/src/conductor brande@<server>:/home/brande/app/conductor
ssh brande@<server> 'sudo systemctl restart qabu-conductor'
```

## First-time install (per server)

```sh
# After copying the binary (above), install the systemd unit
sudo cp qabu-conductor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now qabu-conductor

# Check it's running
journalctl -fu qabu-conductor
```

## File layout expected on the server

```
~/app/
  clients/                        ← watched directory, one subdir per client
    <subdomain>/                  ← recursive copy of config/
      docker-compose.yml
      assets/
      data/
  config/                         ← client template (managed by config service)
    docker-compose.yml
    assets/
    data/
  conductor                       ← the binary
```

## Socket protocol

The provisioner connects to `/run/qabu/conductor.sock` and sends:

```
<subdomain> <tier>\n
```

Conductor responds:

```
ok\n           # created and healthy
err 400\n      # invalid subdomain
err 409\n      # already exists
err 507\n      # budget exceeded (MAX_TIER = 5)
err 503\n      # created but health check timed out (30s)
```

Mount the socket into the provisioner container:
```yaml
volumes:
  - /run/qabu/conductor.sock:/run/qabu/conductor.sock
```

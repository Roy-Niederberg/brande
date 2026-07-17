# Client Server Setup

## Prerequisites

Cloud VM running Ubuntu (24.04 LTS) that you can ssh to.

## Setup

From your dev machine run:
```sh
./setup_server.sh <username>@<vm-ip>
```

> [!NOTE]
> Oracle default user is `ubuntu`.
> The user need to be passwordless sudo.
> the script idempotent (safe to re-run).
> After it runs, `brande` must re-login before the docker group takes effect.
> The default `ubuntu` user is left in place as a **break-glass** account


## 2. Log in to GitLab registry

```sh
ssh brande@<vm> 'docker login registry.gitlab.com'
# Username: the deploy token's username (custom, currently `brande`)
# Password: GitLab deploy token (`gldt-...`) with read_registry scope
#   (created in GitLab: Project → Settings → Repository → Deploy tokens;
#   add read_repository scope if the VM should also clone the repo over HTTPS)
```

## 6. DNS

Add a record for the provisioner endpoint in Cloudflare:

| Type | Name          | Value     | Proxy |
|------|---------------|-----------|-------|
| A    | `main.qabu.net` | `<vm-ip>` | Off   |
| A    | `v[N].qabu.net` | `<vm-ip>` | Off   |

`vN` is the VM number (`v1` for the first client VM, `v2` for the second, etc.).
`main` is the main server.

# The new setup
## SSH key + repo clone (done by `setup_server.sh`)

`setup_server.sh` generates an ed25519 key for `brande`, prints the public key,
and **pauses** while you add it in GitLab: project → Settings → Repository →
Deploy keys (tick "Grant write permissions" so the VM can push). Press Enter and
it clones `git@gitlab.com:qabunet/clients.git` into `~/clients` with
`--no-checkout --filter=blob:none` — no files are checked out or fetched, ready
for sparse checkout. To print the key again later:

```bash
ssh brande@<vm> 'cat ~/.ssh/id_ed25519.pub'
```

To materialize files later, from `~/clients`:

```bash
git sparse-checkout set <dir>...   # pick the paths you need
git checkout main                  # fetches just those blobs
```

## Reconciler (done by `setup_server.sh`)

The reconciler replaces the old conductor. One job: keep the running containers
converged with `*/docker-compose.yml` under `~/clients`. No socket, no client
creation, no subdomain validation, no env files, no polling — it sleeps in
inotify (via `entr`, same idiom as the backup service) and wakes only when a
compose file changes or a directory entry appears, then runs
`docker compose up -d --remove-orphans` per client dir. Compose itself is the
diff engine: unchanged stacks are a no-op (no restart, no downtime), only
changed services get recreated.

`setup_server.sh` installs `entr`, writes the script to
`/usr/local/bin/qabu-reconciler`, and enables the `qabu-reconciler` systemd unit
(`User=brande`, `WorkingDirectory=~/clients` — the unit file is the only place
naming the path; the script itself just watches its cwd). Re-running
`setup_server.sh` redeploys the script and restarts the service.

On the **original client VM** (`129.159.159.251`, migrated off the conductor
2026-07-17) the unit was installed by hand with
`WorkingDirectory=/home/brande/app/clients` — the pre-`~/clients` layout.
Its client compose files are materialized (no `profiles:`, no env-file;
pre-migration backups sit next to them as
`docker-compose.yml.bak-conductor-20260717`).

Notes:

- **No `pull`.** Deploys stay explicit: `docker compose pull` on the VM (or
  reference a new image tag in the compose file). `up` still fetches images it
  doesn't have locally, so new clients start fine.
- **Deleting a compose file does not `down` its stack** — removing a client is
  a manual act.
- **Creating a client** = make the dir, put a `docker-compose.yml` in it. The
  reconciler notices and brings it up.
- Race window: edits landing during a sweep (a few seconds) are missed until
  the next event. `sudo systemctl restart qabu-reconciler` forces a sweep.
- Watch/debug: `journalctl -fu qabu-reconciler`.


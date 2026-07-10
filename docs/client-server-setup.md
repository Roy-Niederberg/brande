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

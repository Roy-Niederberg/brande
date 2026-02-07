# Qabu

Qabu (from Akkadian "to say/speak") is a RAG-based AI agent platform for small
businesses. Clients get a site at `<name>.qabu.net` with an AI chat that answers
customer questions from a knowledge base, plus a widget, Facebook, WhatsApp and
more. See `for_claude.md` for full project context.

- Owners: Roy & Nevo, based in Israel. Domain: `qabu.net` (GoDaddy).
- Infra: Two Oracle Cloud VMs (client server + main server), Docker everywhere.
- Repo: Private GitLab, mirrored to GitHub.

## Dev Philosophy

- Short, simple code. Aim for ~80 line files, ~100 char lines.
- Every line must justify its place. Avoid unnecessary abstractions.
- Minimize third-party dependencies.
- Whitelist `.gitignore` (not blacklist).
- Everything runs in Docker - no node/npm/python on the host.

## Project Structure

```
dev_setup/          - Docker Compose configs for local development
  client/           - Unified client dev environment (parameterized per client)
  main_server/      - Main server dev environment
prod_setup/         - Production deployment configs
  client_server/    - Per-client configs (assets, data, secrets)
  main_server/      - Main server production config
services/           - Service source code (site, prompt_composer, admin, etc.)
```

## Running Clients in Dev Mode

The client dev setup uses a single `docker-compose.yml` parameterized with env files.
Each client has its own `.env` file in `dev_setup/client/`:

- `craftkidstoys.env` - English client (ports 3000/3443)
- `drlipokatz.env` - Hebrew client (ports 3001/4443)

Env vars: `CLIENT` (client dir name), `HTTP_PORT`, `HTTPS_PORT`.

```sh
cd dev_setup/client

# Run a single client
docker compose --env-file craftkidstoys.env up

# Run both clients simultaneously (use -p for separate project names)
docker compose --env-file craftkidstoys.env -p craftkidstoys up
docker compose --env-file drlipokatz.env -p drlipokatz up
```

Client-specific assets, data, and secrets are loaded from `prod_setup/client_server/<client>/`.

## Deployment

Production is deployed via rsync to two Oracle Cloud VMs:
- `prod_setup/client_server/` syncs to the client VM (hosts client sites + agents)
- `prod_setup/main_server/` syncs to the main VM (hosts qabu.net + shared services)

These directories mirror what's running in production.

## Client Assets

Each client has a `client-config.json` in its assets directory (`prod_setup/client_server/<client>/assets/`)
that configures language, direction, title, background image, and social links.

## Admin

The admin reuses the site's `index.html` — no separate HTML. The admin BE fetches
the site's HTML at runtime (`http://site:80/index.html`) and injects
`<script src="/admin/admin.js">` before `loader.js`. This means site layout/style
changes automatically apply to the admin.

`admin.js` does three things:
1. Pre-sets `window.ChatWidgetConfig` (apiEndpoint, beforeSend) — `loader.js` merges
   it via `...(window.ChatWidgetConfig || {})`.
2. Injects the knowledge base editor UI into `.bg-section`.
3. Contains all KB management logic (load, edit, draft/publish).

Request flow:
- Widget chat: browser → Caddy `/admin/*` → admin BE `/ask` (auth) → prompt-composer
- KB load: admin BE `/api/initial-content` → prompt-composer `/knowledge-base`
- KB publish: admin BE `/api/knowledge-base` → prompt-composer `/knowledge-base`

Direction (RTL/LTR) is inherited from the site's `client-config.json` — no toggle needed.

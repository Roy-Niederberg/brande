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

## Caddy Routing

The site Caddyfile (`services/site/src/Caddyfile`) routes:
- `/admin/*` → admin BE (port 9876)
- `/site/*` → prompt-composer (port 4321), prefix stripped
- Everything else → static site files

## Admin

The admin reuses the site's `index.html` — no separate HTML. The admin BE fetches
the site's HTML at runtime (`http://site:80/index.html`) and injects
`<script src="/admin/admin.js">` before `loader.js`. This means site layout/style
changes automatically apply to the admin.

`admin.js` pre-sets `window.ChatWidgetConfig` (apiEndpoint, beforeSend) —
`loader.js` merges it via `...(window.ChatWidgetConfig || {})`. It uses a factory
pattern (`createPanel`/`createEditor`) to build editor panels in `.bg-section`.
Three buttons on the main screen:

1. **Edit Knowledge Base** — CRUD editor for KB entries (`{key, content}` pairs).
   `canModify: true` — supports add/delete entries.
2. **Edit System Prompts** — Editor for `client_question` per module.
   `canModify: false` — keys (module names) are read-only, no add/delete.
3. **See Last Prompt** — Read-only viewer with Admin/Site tabs showing the last
   composed prompt. Tabs switch between `admin_ask_widget` and `site_ask_widget`
   log files. Cached per panel open, with a refresh button.

Both KB and SP editors use localStorage drafts and a publish flow.
`beforeSend` sends both KB and SP draft overrides on every admin chat request,
so changes can be tested in the widget before publishing.

Request flow:
- Admin chat: browser → Caddy `/admin/*` → admin BE `/ask` (auth) → prompt-composer
- Site chat: browser → Caddy `/site/*` → prompt-composer `/ask`
- Initial load: admin BE `/api/initial-content` → prompt-composer `/knowledge-base` + `/prompt-instructions`
- KB publish: admin BE `/api/knowledge-base` → prompt-composer `/knowledge-base`
- SP publish: admin BE `/api/instructions` → prompt-composer `/prompt-instructions`
- Prompt log: admin BE `/api/prompt-log/:name` → prompt-composer `/prompt-log/:name`

### Prompt Logging

The widget sends its `apiEndpoint` in the request body. The prompt-composer uses
`apiEndpoint + module` for the log filename (e.g., `admin_ask_widget.txt` vs
`site_ask_widget.txt`), so admin testing doesn't overwrite production logs.

### System Prompts

Stored in `prod_setup/client_server/<client>/data/system_prompts.json`. Structure:
`{ "module": { greeting: {...}, gatekeeper: "...", client_question: "..." } }`.
The prompt-composer loads them mutably (`let` + `fs.readFileSync`) so they can be
updated at runtime via the admin. Only `client_question` is editable in the admin UI.

### Rate Limiting

The prompt-composer rate limiter (5 req/20s) applies only to `/ask`, not to
config/log endpoints.

Direction (RTL/LTR) is inherited from the site's `client-config.json` — no toggle needed.

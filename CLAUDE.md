# Qabu

Qabu (from Akkadian "to say/speak") is a RAG-based AI agent platform for small
businesses. Clients get a site at `<name>.qabu.net` with an AI chat that answers
customer questions from a knowledge base, plus a widget, Facebook, WhatsApp and
more. See `for_claude.md` for full project context.

- Owners: Roy & Nevo, based in Israel. Domain: `qabu.net` (registered on GoDaddy, DNS on Cloudflare).
- Infra: Two Oracle Cloud VMs (client server + main server), Docker everywhere.
- Repo: Private GitLab (`origin`), mirrored to GitHub (`github` remote).
- Email: `privacy@qabu.net` → Cloudflare Email Routing → `roy.niederberg@gmail.com`

## GitHub Mirror (Claude Code Mobile)

Claude Code on mobile works with GitHub. The GitHub repo is a mirror — GitLab
is the single source of truth. Never merge on GitHub UI.

Add the remote (one-time):
```sh
git remote add github git@github.com:roy-niederberg/brande.git
```

When Claude Code creates a branch on GitHub, merge locally:
```sh
git fetch github                                    # 1. fetch new branches
git branch -r --list 'github/*'                     # 2. see what's new
git diff origin/dev...github/<branch>               # 3. review changes
git merge github/<branch>                           # 4. merge into dev
git push origin                                     # 5. push to GitLab
git push github --delete <branch>                   # 6. clean up remote branch
```

## Setup (new machine)

Install each plugin listed in `.claude/settings.json` via `/plugin install <name>`.
For the local skill, run: `/plugin install local .claude/plugins/qabu-prompt-engineer`

## Skills

Before responding to any request, check the available skills list. If there is
even a 1% chance a skill applies, invoke it with the Skill tool before doing
anything else.

## Communication Style

Be brutally honest — push back when ideas seem wrong. Don't be a yes-man,
challenge decisions that seem off. When discussing changes, always remind Roy to
consider all channels (EN + HE clients, Facebook comment/DM flows, embedded
widget on external sites).

## Portability

Roy doesn't want to be dependent on any specific machine. Everything should be
backed up in git and project-scoped. Avoid globals (stuff in `~/.claude/` or
other home directory paths) when possible — prefer repo-checked-in files like
`CLAUDE.md`, `ROY_TASKS.md`, `CLAUDE_TASKS.md`, etc. If something must live
outside the repo, mention it so Roy can back it up.

## Task Management

When a new task comes up during conversation, add it to the correct file:
- **Roy's tasks** → `ROY_TASKS.md`
- **Claude's tasks** → `CLAUDE_TASKS.md`
- **Unsure** → ask Roy which file

Each task must be **very detailed** with full context so Roy can recall what it's
about later. Include:
1. The conversation context that led to the task (e.g. "While discussing X, we
   realized Y because...")
2. Why it matters / what problem it solves
3. Date of creation in parentheses at the end, e.g. `(added 2026-03-13)`

Roy uses these files as a backlog across conversations. Without context, tasks
become cryptic reminders that are hard to act on weeks later.

Whenever a conversation surfaces something that should be done later (Roy says
"I need to...", "we should...", "add a task for...", or a TODO naturally emerges
from the discussion), proactively write it to the correct file. Don't wait to be
asked — just add it and mention that you did.

## Dev Philosophy

- Short, simple code. Aim for ~80 line files, ~100 char lines.
- Every line must justify its place. Avoid unnecessary abstractions.
- Minimize third-party dependencies.
- Whitelist `.gitignore` (not blacklist).
- Everything runs in Docker - no node/npm/python on the host.
  To generate/regenerate `package-lock.json` for a service (since npm isn't on
  the host), run from the repo root:
  ```sh
  docker run --rm -v "$(pwd)/services/<service>/src/package.json:/app/package.json" \
    -w /app node:22-alpine \
    sh -c "npm install -g npm@latest && npm install && cat package-lock.json" \
    > services/<service>/src/package-lock.json
  ```
  This mounts only `package.json` into the container, runs npm install inside it,
  and pipes the generated lock file to the host via stdout.
  **Do NOT mount the entire `src/` directory** (`-v .../src:/app`) — npm will
  write `node_modules` (root-owned) onto the host through the bind mount.
- **Multi-channel awareness**: Every change must consider all channels — widget
  (EN + HE), Facebook comments, and Facebook DMs. Prompt-composer serves all of
  them, so changes there affect everything. When discussing features, always verify
  they work for both English and Hebrew clients and don't break Facebook flows.

## Brand Colors

### Light mode
- **Primary Light Blue `#85C1E9`** — brand color (30%), bot bubbles, borders
- **Dark Main `#5D6D7E`** — text/headers (10%), user bubbles
- **Background `#FAF4E8`** — base canvas (60%)
- **Accent Blue `#1B4F72`** — highlights, buttons, CTAs

### Dark mode
* **Primary Light Blue** `#2A4359` Brand Color (30%)
* **Dark Main** `#FAF4E8` Text / Headers (10%)
* **Background** `#1C2127 `Base Canvas (60%)
* **Accent / Alt** `#85C1E9` Highlights / Buttons


Use these consistently. The widget and capabilities already follow this palette.
Admin buttons intentionally use distinct per-button colors (not brand colors).

## Express Async Error Handling

Express doesn't catch errors thrown in `async` route handlers. We use `app.r`
to wrap handlers with try/catch and forward errors to the error middleware:

```js
app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{ await f(rq,rs,nxt)} catch(e) {nxt(e)}})
```

Use `app.r('get', '/path', handler)` instead of `app.get('/path', handler)`.
Thrown errors hit the error middleware at the bottom of the file (logs + 500).

## Project Structure

```
clients/                    - Per-client data (assets + data), checked into git
  <subdomain>/
    assets/                 - Static assets (background, profile-pic, client-config, og-meta)
    data/                   - Runtime data (system_prompts.js, knowledge_base.json, etc.)
secrets/                    - Secrets for QA/dev (NOT deployed — VMs have their own copies)
  client_router_secrets/    - Clients-router VM secrets (TLS, JWT, dispatcher)
  clients_secrets/          - Shared per-client secrets (LLM keys, admin secret, etc.)
  main_server_secrets/      - Main server secrets (OAuth, FB app, JWT, dispatcher)
qa/                         - QA environment (simulates both VMs in one Docker Compose)
  docker-compose.yml        - Full QA stack
  docker-compose.dev.yml    - Dev overlay (adds nodemon + source mounts)
  main-router-Caddyfile     - QA version of main router
  clients-router-Caddyfile  - QA version of clients router
prod/                       - Production docker-compose files (deployed to VMs)
  main-server-docker-compose.yml
  client-server-clients-router-docker-compose.yml
services/                   - Dockerized service source code
  config/                   - Client template (init container, copied by conductor on creation)
    files/                  - Default files for a new client (assets/, data/, docker-compose.yml)
docs/                       - Operational guides
  client-server-setup.md    - How to provision a new client VM from scratch
clients_server_automation/  - Host-level automation on the client VM
  conductor/                - systemd daemon that manages client lifecycle
```

## Running the QA Environment

The QA environment simulates both production VMs in a single Docker Compose.
DNS must be configured in Cloudflare (DNS only, grey cloud):
- `qa.qabu.net` → `127.0.0.1`
- `*.qa.qabu.net` → `127.0.0.1`

GCP OAuth: add `http://qa.qabu.net:8080/auth/callback` as redirect URI.

```sh
cd qa

# Production-like mode
docker compose up

# Dev mode (nodemon + source mounts for live reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Access:
- `http://qa.qabu.net:8080` — landing page, auth, onboarding
- `http://dradamblack.qa.qabu.net:8443` — dradamblack client
- `http://drlipokatz.qa.qabu.net:8443` — drlipokatz client

Note: Facebook dispatcher → client forwarding won't work end-to-end in QA
(it does external HTTPS in prod). Use mock-facebook for FB testing.

## Building & Deploying

### Building images

`build.sh` builds and pushes a single service image to the GitLab registry:

```sh
./build.sh <service>    # e.g. ./build.sh prompt_composer
```

This builds with `--target production`, tags as both `v0.1.0` and `latest`,
and pushes to `registry.gitlab.com/rny3/brande/<service>`.

### Deploying to VMs

After pushing images, SSH into the VM and pull + restart:

```sh
# Main server
ssh brande@129.159.134.3 'cd ~/app && docker compose pull && docker compose up -d'

# Client server — shared infra (clients-router, auth-verifier, provisioner)
ssh brande@129.159.159.251 'cd ~/app && docker compose pull && docker compose up -d'

# Client server — a specific client's services
ssh brande@129.159.159.251 'cd ~/app/clients/<sub> && docker compose pull && docker compose up -d'
```

### Server setup

See `docs/client-server-setup.md` for provisioning a new client VM from scratch
(Docker, conductor, clients-router, secrets, DNS).

Two Oracle Cloud VMs:
- Client VM (`brande@129.159.159.251`) — hosts client sites + agents
- Main VM (`brande@129.159.134.3`) — hosts qabu.net + shared services

## Landing Page

The landing page (`services/landing_page/`) is a React/Vite/Tailwind app that
runs as a separate Docker service on the main server. Build & push:

```sh
docker build --no-cache -t registry.gitlab.com/rny3/brande/landing_page:latest services/landing_page/
docker push registry.gitlab.com/rny3/brande/landing_page:latest
```

Deploy:
```sh
ssh brande@129.159.134.3 'cd ~/app && docker compose pull landing-page && docker compose up -d landing-page'
```

Routing: the main router Caddyfile proxies the catch-all to `landing-page:80`.
`/privacy` and `/terms` are still served from `/srv` as static files.

Static assets (videos, images) go in `services/landing_page/public/` — Vite
copies them to `dist/` as-is during build.

## Client Assets

Each client has a `client-config.json` in its assets directory
(`clients/<client>/assets/`) that configures language, direction, title,
background image, and social links.

Each client has a `profile-pic.jpg` in the root of its assets directory (used by
the mock Facebook testing interface and available for the site/widget). Each client
also has a `mock_facebook/` subfolder in assets with `post-data.json` (and optionally
`post-image.jpg`) for the mock Facebook admin testing interface. Missing images
fall back to defaults (SVG avatar, site background).

## Client Profiles

**dradamblack** — English demo client. Cataract surgery clinic (Dr. Adam Black).
English translation of `drlipokatz` with US medical context (insurance instead of
HMO, USD instead of ILS, NY address). Same prompt design patterns, same KB
structure, male doctor.

**drlipokatz** — Hebrew demo client. Cataract surgery clinic (ד"ר ליפו כץ).
Modeled after Nevo's master spec (`Nevo.txt`) with 15 consolidated intents
(`intent.md`). KB has 12 entries covering the cataract patient journey. Key
prompt design patterns:
- **Slot tracking** (prompt-only, no code): the main SP instructs the LLM to
  gather 5 data points naturally (topic, not emergency, HMO, insurance, readiness)
  before showing a booking link. At least 3 must be known.
- **Emergency guardrails**: both gatekeeper (ESCALATE) and main prompt detect
  emergency symptoms (sudden vision loss, severe pain, flashes, dark spots,
  curtain sensation) and respond with ER referral — no booking offered.
- **Tiered CTAs**: soft CTA for educational questions, HMO question for cost
  queries, direct booking CTA for surgery-ready users.

## Caddy Routing

Four Caddyfiles handle routing across the two VMs:

**Main router** (`services/main_router/src/Caddyfile`) — on main VM:
- `qabu.net/facebook*` → facebook-dispatcher (port 3210), prefix stripped
- `qabu.net/auth/*` → auth service (port 3456), prefix stripped
- `qabu.net/onboarding*` → client-onboarding (port 4321), prefix stripped, `forward_auth` via auth service
- `qabu.net/favicon.ico`, `/logo_*.svg` → static from `/srv`
- `qabu.net/privacy*`, `/terms*` → static from `/srv`
- `qabu.net` (everything else) → landing-page

**Clients router** (`services/clients_router/src/Caddyfile`) — on client VM:
- `*.qabu.net` → `{subdomain}-services-router-1:80` (per-client services router)
- `/admin/*` — `forward_auth` via auth-verifier sidecar, redirects to Google login on 401
- `/facebook-*` — validates `X-Dispatcher-Secret` header, rejects 403 if missing
- `/scaffold` → provisioner:4321
- Unknown subdomains → 404 with `X-Qabu: not-found` header

**Services router** (`services/services_router/src/Caddyfile`) — per-client
gateway. Generic routing: `/{service}/...` → `{service}:4321` (prefix stripped).
All services listen on port **4321**. `/assets/*`, `/widget.js`, and `/page/*`
are excluded from the generic routing.
- `/taken` → responds "true" (for onboarding subdomain-taken check)
- `/assets/*` → static file server from `/srv/assets`
- `/widget.js` → widget:4321 (dedicated widget service)
- `/{service}/*` → `{service}:4321` (generic: admin, prompt-composer, facebook-dm, etc.)
- Everything else → site:80 (static file server)

**Site Caddyfile** (`services/site/src/Caddyfile`) — pure static file server:
- Serves `/site` directory with Caddy templates for HTML files

## Site Layout: Chat Section + Site Section

The Qabu site (`index.html`) has a split-view layout with two sections inside a
flex `.container`:

- **`.chat-section`** (`#chat-section`) — holds the chat widget. In admin mode,
  the Facebook test panel overlays this section.
- **`.site-section`** — contains an `<iframe>` showing either the built-in visual
  page (`/page/`) or an external client site (`config.siteUrl`). In admin mode,
  editor panels and admin buttons overlay this section. Capabilities render their
  UI here (passed as `canvasElement` to the widget), overlaying on top of the iframe.

The built-in visual page (`services/site/srv/page/`) has its own `loader.js` that
reads `client-config.json` and renders: background image, overlay title, social
links, and custom font. This separation means the visual page can be developed
independently or swapped for any external URL.

In portrait mode (`max-aspect-ratio: 1/1`), both sections stack as absolute
overlays — the chat section sits on top of the site section.

`loader.js` reorders sections based on direction: LTR puts site-section first
(left), RTL puts chat-section first (right). When embedding the widget on an
external site, `canvasElement` can point to any element (or `null` to disable
capability UI).

## Admin

The admin is fully independent of the site service. It has its own HTML shell
(`services/admin/src/views/index.html`), its own loader
(`services/admin/src/views/loader.js`), and loads the widget from the widget
service (via `/widget.js`). The admin can run standalone with just gateway +
prompt-composer + admin + widget — no site service required.

Admin assets (client-config, background image) are volume-mounted from the
client's `assets/` directory into `/app/assets`.

`admin.js` pre-sets `window.ChatWidgetConfig` (apiEndpoint, beforeSend, greetingOverride) —
`loader.js` merges it via `...(window.ChatWidgetConfig || {})`. It uses a factory
pattern (`createPanel`/`createEditor`) to build editor panels in `.site-section`.
Each editor panel has a **publish** button and a **discard** button (resets draft to
published). Main buttons show a red dot when that editor has unpublished changes.
Six buttons on the main screen:

1. **Edit Knowledge Base** — CRUD editor for KB entries (`{key, content}` pairs).
   `canModify: true` — supports add/delete entries.
2. **Edit System Prompts** — Editor for `client_question` per module.
   `canModify: false` — keys (module names) are read-only, no add/delete.
3. **Edit Greeting** — Editor for widget greeting messages (delay + text pairs).
4. **See Prompt** — Read-only viewer showing the last composed prompt. Cached
   per panel open, with a refresh button.
5. **Test Facebook Comments** — Opens a mock Facebook post (iframe) on the chat
   section (over the widget). Admin types comments, JS formats chat history matching
   `facebook_comments` service format, POSTs to `/admin/ask` with `mod:
   'facebook_comments'` + draft overrides from localStorage. Opens independently
   of other panels so admin can edit SP on one side and test on the other.
6. **Manage Services** — Toggle panel for enabling/disabling optional services.
   Changes are saved to `data/config.env` (sets `COMPOSE_PROFILES=`) and take
   effect on next `docker compose up`.

All three editors (KB, SP, greeting) use localStorage drafts and a publish flow.
`beforeSend` sends KB and SP draft overrides on every admin `/ask` request.
`greetingOverride` is called by `widget.js` `playGreeting()` instead of fetching
`/greeting` from the server, so greeting draft changes are also testable before publishing.

### Authentication

Centralized Google OAuth via `services/auth/` on the main server (`qabu.net/auth/*`).
One GCP OAuth app, one callback URL. JWT cookie (`qabu_token`) on `.qabu.net` works
for all subdomains.

- **auth** (main server) — Google OAuth flow + JWT issuance + verify endpoint
- **auth-verifier** (client VM) — JWT signature check sidecar (~30 lines)
- Admin: Caddy `forward_auth` → auth-verifier → `X-Auth-Email` header → admin checks per-client allowlist
- Onboarding: Caddy `forward_auth` → auth service → `X-Auth-Email` header → service checks email allowlist
- Dev mode: admin skips email check when `NODE_ENV=development`; onboarding always
  requires auth (use the dev browser extension to inject `X-Auth-Email`)

Admin → prompt-composer trust is established via a shared `admin_secret` (per-client
Docker secret). The admin BE reads it at startup and sends it as `x-admin-secret` on
every `/ask` forward. The prompt-composer only honours `sp_override`/`kb_override`
fields if the header matches — requests from the site or Facebook without the header
have overrides silently stripped. In dev both sides default to `'dev'`.

JWT: HMAC-SHA256, 24h expiry, claims `{ email, name, picture, iat, exp }`.
Signing key shared between main server and client router (`jwt_signing_key` secret).

Request flow:
- Admin chat: browser → client router → forward_auth → services-router `/admin/*` → admin BE `/ask` → prompt-composer
- Site chat: browser → client router → services-router `/prompt-composer/*` → prompt-composer `/ask`
- Initial load: admin BE `/api/initial-content` → prompt-composer `/knowledge_base` + `/system_prompts` + `/greeting`
- KB publish: admin BE `/api/knowledge_base` → prompt-composer `/knowledge_base`
- SP publish: admin BE `/api/system_prompts` → prompt-composer `/system_prompts`
- Services: admin BE `/api/services` → prompt-composer `/services`

### Prompt Logging

After each LLM call, the prompt-composer writes the full request + response to
`data/last_prompt.json` (overwritten each time). Readable via `GET /last_prompt`
(proxied through admin as `GET /api/last_prompt`).

### System Prompts

Stored in `clients/<client>/data/system_prompts.js`. Structure (ES module):
`export default { module: { gatekeeper: "...", main: "...", capabilities: "..." } }`.
The prompt-composer loads them via `import` at startup. `main` and `capabilities`
are editable in the admin UI. The `capabilities` key is optional — modules without
it (e.g. `facebook_comments`) don't get capability instructions in their prompt.

The gatekeeper returns **plain text** (no JSON/tool use):
- `IGNORE` → drop the request silently
- `ESCALATE` → pass to the main model with full KB
- anything else → send directly as the reply (e.g. a short greeting response)

### Rate Limiting

The prompt-composer rate limiter (5 req/20s) applies only to `/ask`, not to
config/log endpoints.

Direction (RTL/LTR) is inherited from the site's `client-config.json` — no toggle needed.

## Capabilities (LLM Tool Use)

The LLM can trigger client-side UI actions (forms, delays, etc.) via capabilities.
Each client has a `capabilities.js` in its `data/` directory — an ES module
(`export default { ... }`) with named capabilities, each having `description` and
`run(args, canvasElement)`.

### How It Works

1. **Prompt-composer** imports `capabilities.js` at startup, extracts
   `name: description` pairs, and appends them to the prompt when the module's SP
   has a `capabilities` key. The composed prompt is:
   `main + capabilities_instructions + #CAPABILITIES list + #KNOWLEDGE BASE`.
2. **The LLM** ends its reply with an action block:
   ```
   || ACTIONS
   || sleep 2000
   || contact_form
   ```
3. **The widget** parses the `|| ACTIONS` block, strips it from displayed text,
   and runs each action sequentially. Each `run()` returns
   `{ result: string, continue: boolean }`. Non-empty results are collected and
   auto-sent back to the LLM (with `skip_gk: true` to bypass the gatekeeper).
4. **Canvas element**: capabilities that show UI receive `canvasElement` (set via
   `ChatWidgetConfig.canvasElement`, defaults to `null`). On the Qabu site this is
   `.site-section`. The widget itself stays decoupled from the site layout.

### Files

- `clients/<client>/data/capabilities.js` — per-client capabilities
- `services/widget/widget.js` — shared widget, action parsing + execution loop
- `services/prompt_composer/src/server.js` — loads capabilities, injects into prompt

### Prompt-Composer Data Loading

All data files are loaded via ES `import` at startup into the global `$` object.
The `crud` loop registers GET (serves file from disk) and POST (updates `$` +
writes to disk) endpoints for each file. JSON files use `writeJSON` (with
`JSON.stringify`), JS files use `writeFile` (raw string).

```js
const $ = {}
for (const f of files) {
  $[name] = (await import(`./data/${f}`, arg)).default
  // GET serves from disk, POST updates $ and writes to disk
}
```

### Request Flags

- `skip_gk: true` — skip gatekeeper (used for capability result follow-ups)

## Widget Service

The widget (`services/widget/`) is a dedicated Caddy service that serves
`widget.js` on port 4321. It is routed via the services-router at `/widget.js`.
All three consumers get the widget from the same URL:

- **Site** — `loader.js` loads `<script src="/widget.js">`
- **Admin** — `loader.js` loads `<script src="/widget.js">`
- **External embed** — `<script src="https://clientname.qabu.net/widget.js">`

The widget is a core service — if a client exists, the widget is accessible. It
talks directly to the prompt-composer (via `/prompt-composer/ask`). Version
management is via Docker image tags, no file copying or volume mounts needed.

Source: `services/widget/widget.js`. It loads per-client capabilities via dynamic
`import('/site/capabilities.js')`.

Config options: `targetElement` (selector or element, defaults to `document.body`),
`canvasElement` (element for capability UI, defaults to `null`),
`apiEndpoint`, `fontFamily`, `googleFontsUrl`, `beforeSend`, `greetingOverride`.

### Known Issues

- **Minimize/reopen was removed.** An earlier version (commit `ea62340`, when the
  widget lived at `services/router/public/widget.js`) had minimize/maximize with a
  floating reopen bubble — essential for embedding on existing pages. This was lost
  in the "big rewrite" (`6cdf7d5`). Should be restored for embed use cases.

## Client Onboarding & Provisioning

### Flow

1. User goes to `qabu.net/onboarding`, authenticates via Google OAuth
2. Enters a subdomain name, client validates format
3. Onboarding checks if subdomain is taken (`https://{sub}.qabu.net/taken`)
4. Tries VMs in order (`v1.qabu.net`, `v2.qabu.net`, ...) via `POST /scaffold`
5. Provisioner validates `X-Provision-Secret`, delegates to conductor via Unix socket
6. Conductor creates client directory (copies from `config/` template), starts stack
7. On success: redirects to `https://{sub}.qabu.net/admin`

### Services

- **client-onboarding** (`services/client_onboarding/`) — Express app on main
  server at `qabu.net/onboarding`. Auth via Google OAuth + `onboarding_emails`
  allowlist. Subdomain validation: `^[a-z][a-z0-9-]{3,18}[a-z]$` (5–20 chars).
- **provisioner** (`services/provisioner/`) — thin proxy on client VM, receives
  `POST /scaffold` (authenticated by `X-Provision-Secret`), talks to conductor
  via Unix socket at `/run/qabu/conductor.sock`.
- **conductor** (`clients_server_automation/conductor/`) — C++20 systemd daemon
  on client VM. Manages full client lifecycle: creation, file watching, reconciliation.

### Config Service

The config service (`services/config/`) is an init container that ships the client
template. It runs once on `docker compose up`, copying `files/` into
`~/app/config/` on the VM. The conductor uses this template when creating new
clients (copies `config/` → `clients/<subdomain>/`).

The template includes:
- `docker-compose.yml` — client compose with all services, using Docker Compose profiles
- `assets/client-config.json` — default client config
- `data/` — default system_prompts.js, capabilities.js, greeting.json,
  knowledge_base.json, config.env

### Conductor Details

See `clients_server_automation/conductor/README.md` for full details, build
instructions, and socket protocol. Key behaviors:
- Watches `~/app/clients/` via inotify — restarts client stacks on compose file changes
- Reconciles every 60s: every client dir with a compose file should have a running stack
- Handles creation requests from provisioner via Unix socket at `/run/qabu/conductor.sock`

### Docker Compose Profiles

Each client's `docker-compose.yml` (from the config template) uses profiles to
control which services run. Core services (widget, services-router,
prompt-composer, admin) have no profile and always run. Optional services have
profiles:
- `site` — site service
- `facebook` — facebook-comments, facebook-dm, mock-facebook

`data/config.env` sets `COMPOSE_PROFILES=` (e.g. `COMPOSE_PROFILES=site,facebook`).
The admin "Manage Services" UI edits this file — changes take effect on next
`docker compose up`.

### Subdomain Validation

`^[a-z][a-z0-9-]{3,18}[a-z]$` (5–20 chars). Exists in both onboarding
(`SUBDOMAIN_RE`) and conductor (`valid_sub()`) — these MUST stay in sync.

## Secrets

Secrets are organized by scope:

- `secrets/client_router_secrets/` — clients-router VM (TLS, JWT, dispatcher, provisioner)
- `secrets/clients_secrets/` — shared per-client (LLM API keys, admin secret, authorized emails)
- `secrets/main_server_secrets/` — main server (OAuth, FB app, JWT, dispatcher, onboarding)

The `secrets/` directory in the repo is used by the QA docker-compose only. In
production, secrets are copied manually to each VM. Future plan: Infisical.

Shared secrets that must match across VMs:

| Secret                 | Used by                                    |
|------------------------|--------------------------------------------|
| `jwt_signing_key`      | Auth (main) + auth-verifier (client)       |
| `fb_dispatcher_secret` | Facebook dispatcher (main) + clients-router|
| `provision_secret`     | Onboarding (main) + provisioner (client)   |
| `cloudflare_api_token` | TLS on both VMs                            |

## Facebook Integration

Facebook webhooks use a centralized dispatcher on the main server that routes
events to the correct client server by page ID.

Request flow:
```
Facebook webhook → https://qabu.net/facebook
  → main_router → facebook-dispatcher (validates HMAC signature)
  → looks up page_id in page_routes.json → client hostname
  → HTTPS forward to https://{client}.qabu.net/facebook-{dm|comments}
  → client router (validates X-Dispatcher-Secret) → services-router
  → facebook-dm or facebook-comments
  → prompt-composer → LLM → reply to Facebook API
```

### Page Routing

`services/main_router/data/page_routes.json` maps Facebook page IDs to client
hostnames: `{ "808626769002262": "dradamblack.qabu.net" }`. The dispatcher
loads this at startup.

### Authentication

- Facebook → dispatcher: HMAC-SHA256 signature verification (`fb_app_secret`)
- Dispatcher → client router: shared secret header (`X-Dispatcher-Secret`)
- The `fb_dispatcher_secret` lives on the main server (dispatcher) and the client
  VM router — not per-client

### Services

- **facebook-dispatcher** (main server) — validates webhooks, routes by page ID
- **facebook-dm** (per client) — handles DMs, fetches conversation history
- **facebook-comments** (per client) — handles comment threads, traverses tree
- **mock-facebook** (per client, dev only) — mock Facebook post UI for admin testing
- **facebook-signup** (main server, standalone) — OAuth flow for page tokens

## Gotchas

- YAML flow mappings `{file: ...}` break with `${VAR}` inside — use block style
  instead.
- `client-config.json` in assets controls `backgroundImage` — must match actual
  filename.
- Panels hidden with `display:none` break `scrollHeight` — run `autoResize` on
  open.
- `.prompt` has `overflow-y:auto` which scrolls padding (was an issue when log
  panel used flex layout).

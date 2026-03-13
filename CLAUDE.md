# Qabu

Qabu (from Akkadian "to say/speak") is a RAG-based AI agent platform for small
businesses. Clients get a site at `<name>.qabu.net` with an AI chat that answers
customer questions from a knowledge base, plus a widget, Facebook, WhatsApp and
more. See `for_claude.md` for full project context.

- Owners: Roy & Nevo, based in Israel. Domain: `qabu.net` (GoDaddy).
- Infra: Two Oracle Cloud VMs (client server + main server), Docker everywhere.
- Repo: Private GitLab (`origin`), mirrored to GitHub (`github` remote).

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
- **Multi-channel awareness**: Every change must consider all channels — widget
  (EN + HE), Facebook comments, and Facebook DMs. Prompt-composer serves all of
  them, so changes there affect everything. When discussing features, always verify
  they work for both English and Hebrew clients and don't break Facebook flows.

## Brand Colors

- **Primary Light Blue `#A6D0DD`** — brand color (30%), bot bubbles, borders
- **Dark Navy `#0F2C59`** — text/headers (10%), user bubbles
- **Background `#F8F9FA`** — base canvas (60%)
- **Accent Blue `#3276AA`** — highlights, buttons, CTAs

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

- `dradamblack.env` - English client (ports 3000/3443)
- `drlipokatz.env` - Hebrew client (ports 3001/4443)

Env vars: `CLIENT` (client dir name), `HTTP_PORT`, `HTTPS_PORT`.

```sh
cd dev_setup/client

# Run a single client
docker compose --env-file dradamblack.env up

# Run both clients simultaneously (use -p for separate project names)
docker compose --env-file dradamblack.env -p dradamblack up
docker compose --env-file drlipokatz.env -p drlipokatz up
```

Client-specific assets, data, and secrets are loaded from `prod_setup/client_server/<client>/`.

## Deployment

Run from repo root on the `dev` branch (clean, in sync with origin):

```sh
./deploy.sh           # full deploy
./deploy.sh --dry-run # preview without changes
```

What it does:
1. Pre-flight: must be on `dev`, clean, and in sync with `origin/dev`
2. Detects services changed since last `deploy-*` tag → builds + pushes Docker images to GitLab registry
3. Pulls runtime-edited data from prod VMs back into `prod_setup/*/data/`
4. Rsyncs `prod_setup/client_server/` → client VM, `prod_setup/main_server/` → main VM
5. SSH: `docker compose pull && docker compose up -d` on each VM
6. Commits any synced data changes and tags the deploy (`deploy-YYYY-MM-DD`)

Two Oracle Cloud VMs:
- Client VM (`brande@129.159.159.251`) — hosts client sites + agents
- Main VM (`brande@129.159.134.3`) — hosts qabu.net + shared services

These directories mirror what's running in production.

## Client Assets

Each client has a `client-config.json` in its assets directory (`prod_setup/client_server/<client>/assets/`)
that configures language, direction, title, background image, and social links.

Each client also has a `mock_facebook/` subfolder in assets with `post-data.json`
(and optionally `profile-pic.jpg`, `post-image.jpg`) for the mock Facebook admin
testing interface. Missing images fall back to defaults (SVG avatar, site background).

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

Three Caddyfiles handle routing across the two VMs:

**Main router** (`services/main_router/src/Caddyfile`) — on main VM:
- `qabu.net/facebook*` → facebook-dispatcher (port 3210), prefix stripped
- `qabu.net/auth/*` → auth service (port 3456), prefix stripped
- `qabu.net/onboarding*` → client-onboarding (port 8559), prefix stripped, `forward_auth` via auth service
- `qabu.net` (everything else) → static site files

**Client router** (`services/router/src/Caddyfile`) — on client VM:
- `*.qabu.net` → `{subdomain}-site-1:80` (client sites)
- `/admin/*` — `forward_auth` via auth-verifier sidecar, redirects to Google login on 401
- `/facebook/*` — validates `X-Dispatcher-Secret` header, rejects 403 if missing

**Site Caddyfile** (`services/site/src/Caddyfile`) — per client container:
- `/admin/*` → admin BE (port 9876)
- `/site/*` → prompt-composer (port 4321), prefix stripped
- `/facebook/dm` → facebook-dm (port 3210)
- `/facebook/comments` → facebook-comments (port 3210)
- `/mock-facebook/*` → mock-facebook (port 3210)
- Everything else → static site files

## Site Layout: Chat Section + Site Section

The Qabu site (`index.html`) has a split-view layout with two sections inside a
flex `.container`:

- **`.chat-section`** (`#chat-section`) — holds the chat widget. In admin mode,
  the Facebook test panel overlays this section.
- **`.site-section`** — holds the background image, branding overlay, and in admin
  mode the editor panels and admin buttons. Capabilities render their UI here
  (passed as `canvasElement` to the widget).

In portrait mode (`max-aspect-ratio: 1/1`), both sections stack as absolute
overlays — the chat section sits on top of the site section.

`loader.js` reorders sections based on direction: LTR puts site-section first
(left), RTL puts chat-section first (right). When embedding the widget on an
external site, `canvasElement` can point to any element (or `null` to disable
capability UI).

## Admin

The admin reuses the site's `index.html` — no separate HTML. The admin BE fetches
the site's HTML at runtime (`http://site:80/index.html`) and injects
`<script src="/admin/admin.js">` before `loader.js`. This means site layout/style
changes automatically apply to the admin.

`admin.js` pre-sets `window.ChatWidgetConfig` (apiEndpoint, beforeSend, greetingOverride) —
`loader.js` merges it via `...(window.ChatWidgetConfig || {})`. It uses a factory
pattern (`createPanel`/`createEditor`) to build editor panels in `.site-section`.
Each editor panel has a **publish** button and a **discard** button (resets draft to
published). Main buttons show a red dot when that editor has unpublished changes.
Five buttons on the main screen:

1. **Edit Knowledge Base** — CRUD editor for KB entries (`{key, content}` pairs).
   `canModify: true` — supports add/delete entries.
2. **Edit System Prompts** — Editor for `client_question` per module.
   `canModify: false` — keys (module names) are read-only, no add/delete.
3. **Edit Greeting** — Editor for widget greeting messages (delay + text pairs).
4. **See Prompt** — Read-only viewer with Admin/Site tabs showing the last
   composed prompt. Tabs switch between `admin_ask_widget` and `site_ask_widget`
   log files. Cached per panel open, with a refresh button.
5. **Test Facebook Comments** — Opens a mock Facebook post (iframe) on the chat
   section (over the widget). Admin types comments, JS formats chat history matching
   `facebook_comments` service format, POSTs to `/admin/ask` with `mod:
   'facebook_comments'` + draft overrides from localStorage. Opens independently
   of other panels so admin can edit SP on one side and test on the other.

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
- Dev mode: no auth (admin/onboarding skip email check when `NODE_ENV=development`)

JWT: HMAC-SHA256, 24h expiry, claims `{ email, name, picture, iat, exp }`.
Signing key shared between main server and client router (`jwt_signing_key` secret).

Request flow:
- Admin chat: browser → Caddy `/admin/*` → forward_auth → admin BE `/ask` → prompt-composer
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
`{ "module": { gatekeeper: "...", main: "...", capabilities: "..." } }`.
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

- `prod_setup/client_server/<client>/data/capabilities.js` — per-client capabilities
- `services/site/srv/widget.js` — action parsing + execution loop
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
- `skip_kb: true` — skip knowledge base injection
- `skip_caps: true` — skip capabilities injection

## Widget Embeddability

The widget (`widget.js`) is designed to be embeddable on any external site with
a config object and a script tag. It loads per-client capabilities via dynamic
`import('/site/capabilities.js')`.

Config options: `targetElement` (selector or element, defaults to `document.body`),
`canvasElement` (element for capability UI, defaults to `null`),
`apiEndpoint`, `fontFamily`, `googleFontsUrl`, `beforeSend`, `greetingOverride`.

### Known Issues

- **Minimize/reopen was removed.** An earlier version (commit `ea62340`, when the
  widget lived at `services/router/public/widget.js`) had minimize/maximize with a
  floating reopen bubble — essential for embedding on existing pages. This was lost
  in the "big rewrite" (`6cdf7d5`). Should be restored for embed use cases.

## Client Onboarding

Internal tool at `qabu.net/onboarding` for collecting new client info before
scaffolding their directory. Express app (port 8559) on the main server.

- Single HTML page: list of existing configs + form to create/edit
- Multipart upload via `busboy` for background image, profile pic, post image
- Data stored in a **named Docker volume** (`onboarding_data`) — not in
  `prod_setup/`, so `deploy.sh --delete` rsync won't wipe uploaded images
- Auth: Google OAuth via centralized auth service + email allowlist in service
- Auto-derives `direction`, `font`, and `locale` from `lang` (en/he)
- Saves `config.json` + images per subdomain in `/app/data/<subdomain>/`

Dev: `cd dev_setup/main_server && docker compose up client-onboarding` → `localhost:8559`

## Facebook Integration

Facebook webhooks use a centralized dispatcher on the main server that routes
events to the correct client server by page ID.

Request flow:
```
Facebook webhook → https://qabu.net/facebook
  → main_router → facebook-dispatcher (validates HMAC signature)
  → looks up page_id in page_routes.json → client hostname
  → HTTPS forward to https://{client}.qabu.net/facebook/{dm|comments}
  → client router (validates X-Dispatcher-Secret) → site Caddy
  → facebook-dm or facebook-comments
  → prompt-composer → LLM → reply to Facebook API
```

### Page Routing

`prod_setup/main_server/data/page_routes.json` maps Facebook page IDs to client
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

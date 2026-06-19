# Qabu Architecture Reference

Deep reference for Qabu's infra, routing, admin/site UI, capabilities, widget,
onboarding, secrets, and Facebook integration. `CLAUDE.md` keeps short summaries
and points here. Read the relevant section before touching any of these areas.

## VM Strategy

Three VMs, picked across clouds to avoid single-vendor lock-in:

- **Main** (Oracle, `brande@129.159.134.3`) — singleton. Landing page, auth,
  FB dispatcher, onboarding. Scales vertically.
- **Clients #1** (Oracle, `brande@129.159.159.251`) — multi-tenant: drlipokatz,
  eintal, yomialpurrer. (`dradamblack` is kept locally but not currently
  deployed — see Client Profiles in `CLAUDE.md`.)
- **Clients #2** (GCP, IPv6-only) — multi-tenant, currently just ofirfichman.
  Doubles as an IPv6-only hosting testbed.

### Why multi-tenant (not VM-per-client)

The cleaner mental model is **one VM per client**: a client = a VM + a
docker-compose + some DNS. Clean separation, trivial "conductor" (just systemd),
per-client geolocation and vertical scale, dead-simple onboarding (create VM,
pull images, start). That was the original plan.

We went multi-tenant because VMs cost money and we want to try many clients
cheaply — Oracle free tier gives two VMs, GCP gives one. Multi-tenant creates
real complications:

- A second docker-compose network per VM.
- A fuzzy split between `clients-router` and each client's `services-router`.
- Onboarding must find a VM with capacity, not just spin up a new one.
- The `conductor` daemon exists specifically to watch N client stacks per VM;
  VM-per-client would collapse this to plain systemd.

### The clients-router ↔ services-router tension

The biggest architectural tension in this setup. The rule we want to hold:

- **clients-router** — cross-cutting concerns only (TLS, `forward_auth` for
  admin, dispatcher secret validation, rate limits).
- **services-router** — per-client URL routing only, nothing cross-cutting.

If a future feature blurs that line or pushes cross-cutting logic into the
services-router, that's the signal to reconsider the VM-per-client model —
not the signal to add more glue. **Keep this split in mind on every routing
or auth decision.**

### Multi-cloud

Oracle + GCP today, Azure possibly later. Goal: **platform portability** —
we should be able to rebuild Qabu on any single cloud in a reasonable time.
Scattering clients across clouds is a side-effect of free-tier limits, not a
strategy; all clients of a given kind should be movable together.

### IPv6 per client (considered, not adopted)

Tempting because IPv6 space is effectively free — one address per client
without buying VMs. But it doesn't actually eliminate the clients-router:
Facebook webhooks, Meta API, and most corporate networks still need an IPv4
front door. The GCP IPv6-only VM (ofirfichman) proves the hosting model works;
it doesn't remove the need for a central routing layer.

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
All services listen on port **4321**. `/private/*`, `/widget.js`, and `/page/*`
are excluded from the generic routing.
- `/taken` → responds "true" (for onboarding subdomain-taken check)
- `/widget.js`, `/widget.css` → widget:4321 (dedicated widget service)
- `/{service}/*` → `{service}:4321` (generic: admin, prompt-composer, facebook-dm, etc.)
- Everything else (including `/private/*`) → site:80 (static file server)

**Site Caddyfile** (`services/site/src/Caddyfile`) — serves from the shared `ui`
volume (HTML, loader, page) and the client's `private/` volume.

## Shared UI — Admin Owns, Site Mounts

The admin and site share the exact same HTML shell, loader, and visual page.
**The admin is WYSIWYG** — what the client sees while configuring is identical to
what their customers see on the public site. The only difference is the admin
overlay (editor panels, buttons) injected by `admin.js`.

### How it works

The admin Docker image owns the shared UI files (`index.html`, `loader.js`,
`page/`). On startup, `server.js` copies them to the `ui` named volume. The
site service mounts this volume read-only and serves the same files publicly.

```
admin image → /app/views/{index.html, loader.js, page/}
           → copies to /app/ui/ (ui volume) on startup
site image → mounts ui volume at /site/ui/ (read-only)
```

In the client docker-compose:
```yaml
volumes:
  ui:    # shared between admin and site

services:
  admin:
    volumes: [./private:/app/private, ui:/app/ui]
  site:
    volumes: [./private:/site/private, ui:/site/ui:ro]
    depends_on: [admin]
```

### Context detection

A single `loader.js` serves both contexts. It detects admin vs site by checking
`location.pathname.startsWith('/admin')`:
- **Admin**: dynamically loads `admin.js` first (sets `ChatWidgetConfig` overrides
  for draft testing), prefixes fetches with `/admin` (e.g. `/admin/private/...`)
- **Site**: loads the widget directly, fetches from `/private/...`

The visual page (`page/`) uses relative paths (`../private/client-config.json`,
`../private/background.png`) so it resolves correctly under both `/page/` (site)
and `/admin/page/` (admin).

### Layout

The shared `index.html` has a split-view layout with two sections inside a flex
`.container`:

- **`.chat-section`** (`#chat-section`) — holds the chat widget. In admin mode,
  the Facebook test panel overlays this section.
- **`.site-section`** — contains an `<iframe>` showing either the built-in visual
  page (`/page/`) or an external client site (`config.siteUrl`). In admin mode,
  editor panels and admin buttons overlay this section. Capabilities render their
  UI here (passed as `canvasElement` to the widget), overlaying on top of the iframe.

In portrait mode (`max-aspect-ratio: 1/1`), both sections stack as absolute
overlays — the chat section sits on top of the site section.

`loader.js` reorders sections based on direction: LTR puts site-section first
(left), RTL puts chat-section first (right). When embedding the widget on an
external site, `canvasElement` can point to any element (or `null` to disable
capability UI).

### Important

Any change to the shared UI files (`index.html`, `loader.js`, `page/`) affects
both admin and site. This is intentional — they must stay in sync. Only `admin.js`
is admin-specific.

## Admin

The admin shares the same UI shell as the site (WYSIWYG). It can run standalone
with just services-router + prompt-composer + admin + widget — no site service
required. When site is disabled, admin still serves `/page/` from its own Express
routes.

Admin config & assets (client-config, background image, config.env) are
volume-mounted from the client's `private/` directory into `/app/private`.

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
   Changes are saved to `private/config.env` (sets `COMPOSE_PROFILES=`) and take
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
`logs/last_prompt.json` (overwritten each time). Readable via `GET /last_prompt`
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

Direction (RTL/LTR) is passed via `ChatWidgetConfig.direction` — the widget
sets `targetElement.dir` accordingly. The site/admin loaders read it from
`client-config.json` and pass it through. RTL support includes flipped bubble
border-radius, margins, padding, shadows, and dropdown positioning.

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
`apiEndpoint`, `fontFamily`, `googleFontsUrl`, `beforeSend`, `greetingOverride`,
`direction` (RTL/LTR, defaults to `'ltr'`), `profilePic` (URL or data URI,
defaults to Qabu logo SVG), `clientName` (header title, defaults to `'Qabû'`).

## Notifier Service

Per-client activity digests by email (`services/notifier/`). Design goal:
prompt-composer stays single-responsibility — it *answers*; it only records
the fact that it answered. The notifier interprets those facts and emails.

**Event log (the API).** prompt-composer appends one JSON line per answered
`/ask` to `logs/events.jsonl` (same `./logs` volume that holds
`last_prompt.json`):

```json
{"ts":"2026-06-11T07:18:32.000Z","channel":"widget","model":"gemini-3.5-flash","outcome":"main"}
```

- `channel` = `body.mod` (`widget`, `facebook_comments`, `facebook_dm`) — all
  channels covered automatically since everything flows through `/ask`.
- `outcome` ∈ `gatekeeper` (gatekeeper replied directly), `main`,
  `unavailable` (all retries exhausted — `model` omitted).
- Admin-secret (trusted) test calls and `IGNORE`d comments are **not** logged.
- The file is append-only and generic: future event types just add lines with
  new fields; the notifier forwards the raw lines as-is, so no formatting code
  to update. Adding a new notification source means appending JSONL, not
  touching the producer's API.
- Growth is ~150 B/event; rotation is accepted debt for now.

**Notifier loop.** No inbound port, no services-router entry — a pure
consumer. Once a day (hour 12, system local time) it emails the new entries
of `events.jsonl` as raw text — no parsing. It self-reschedules with a single
`setTimeout` to the next noon (recomputed each cycle); the process sleeps in
between, no polling. To track "what's new" it **drains** the log rather than
storing a byte offset: at send time it renames `events.jsonl` to
`events.sending` (atomic — concurrent appends from prompt-composer land in a
fresh log, never lost), emails it, and deletes `events.sending` only after a
successful send. A failed send leaves the file in place; the next cycle skips
the rename (so the pending batch is never clobbered) and retries it, then
picks up freshly accumulated events the cycle after. No offset file means
hand-editing or truncating `events.jsonl` can't desync anything.

**Email.** Resend REST API (`https://api.resend.com/emails`), key in the
`resend_api_key` secret (shared per-client secret, like the LLM keys). From
`notifications@qabu.net`. The Resend account setup (done 2026-06-12, Roy's
account): `qabu.net` verified as a sending domain — DKIM TXT at
`resend._domainkey`, SPF TXT + MX on `send.qabu.net`, and a monitor-only
DMARC record, all added manually in Cloudflare DNS (grey cloud). These live
on the `send.` subdomain so they don't touch the `qabu.net` MX records that
Cloudflare Email Routing uses for inbound mail. Free tier: 3k emails/month. Recipients come from `data/notify.json` (a JSON array
of addresses, mounted read-only) — read on every send, so edits apply live
without a restart. It lives in `data/` rather than `private/` deliberately:
the site service serves `private/` publicly, and email lists shouldn't be
fetchable. Subject is `Qabû — <title> — daily digest`, with `title` read from
`private/client-config.json` (mounted read-only) on every send — no extra
name-plumbing through conductor or env. Body is the raw log chunk, verbatim
JSONL, one event per line:

```
{"ts":"2026-06-19T10:18:00.000Z","model":"gemini-3.5-flash","channel":"facebook_comments","outcome":"main"}
{"ts":"2026-06-19T10:24:00.000Z","model":"gemini-3.1-flash-lite","channel":"widget","outcome":"main"}
```

SMTP was rejected because Oracle/GCP block outbound SMTP ports; HTTP POST
from prompt-composer to the notifier was rejected because it couples the hot
`/ask` path to the notifier's existence.

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
- `private/` — default client-config.json, config.env
- `data/` — default system_prompts.js, capabilities.js, greeting.json,
  knowledge_base.json

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

`private/config.env` sets `COMPOSE_PROFILES=` (e.g. `COMPOSE_PROFILES=site,facebook`).
The admin "Manage Services" UI edits this file — changes take effect on next
`docker compose up`.

### Subdomain Validation

`^[a-z][a-z0-9-]{3,18}[a-z]$` (5–20 chars). Exists in both onboarding
(`SUBDOMAIN_RE`) and conductor (`valid_sub()`) — these MUST stay in sync.

## Secrets

Secrets are organized by scope:

- `secrets/client_router_secrets/` — clients-router VM (TLS, JWT, dispatcher, provisioner)
- `secrets/clients_secrets/` — shared per-client (LLM API keys, admin secret, authorized emails, Resend API key)
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

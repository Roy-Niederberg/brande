# Qabu Architecture Reference

Deep reference for Qabu's infra, routing, admin/site UI, capabilities, widget,
onboarding, secrets, and Facebook integration. `CLAUDE.md` keeps short summaries
and points here. Read the relevant section before touching any of these areas.

## VM Strategy

Four VMs, all Oracle Always Free, all Ubuntu, SSH as `brande` with the same
key (as of 2026-07-06):

| VM         | IP              | Role                                   | Arch    | CPUs   | RAM   | OS           |
|------------|-----------------|----------------------------------------|---------|--------|-------|--------------|
| Main       | 129.159.134.3   | Singleton: landing pages, auth, FB dispatcher, onboarding | x86_64 | 2 vCPU | 1 GB | Ubuntu 24.04 |
| Clients #1 | 129.159.159.251 | Multi-tenant: drlipokatz, eintal, eintal-hadassah, yomialpurrer, dradamblack, aram-ent | x86_64 | 2 vCPU | 1 GB | Ubuntu 24.04 |
| arm1       | 129.159.154.37  | **Idle** — provisioned (`setup_server.sh` done), no role yet | aarch64 | 3 vCPU | 18 GB | Ubuntu 24.04 |
| arm2-small | 129.159.141.23  | **Not available** — repurposed for Roy's personal (non-Qabu) use, 2026-07 | aarch64 | 1 vCPU | 6 GB | Ubuntu 24.04 |

The two x86 VMs are `E2.1.Micro` (1 OCPU = 2 vCPUs via SMT); the two ARM VMs
are `A1.Flex` and together consume the entire 4 OCPU / 24 GB ARM free pool.
The plan is to migrate clients from the cramped Clients #1 micro to **arm1
only** — arm2-small is off the table for now (personal use) — see the ARM
tasks in `TASKS.md` for status and remaining steps (role setup, per-client
migration; the reconciler is a shell script, so nothing needs an ARM build).

A second VM, **Clients #2** (GCP, IPv6-only), hosted the `ofirfichman` demo
client from 2026-06 to 2026-07-04. Retired: the IPv6-only egress caused
recurring problems (no NAT64 path to the IPv4-only GitLab registry, ACME
cert-renewal failures once Cloud NAT was removed) that outweighed the value of
one demo client. Terminated rather than fixed further.

### Why multi-tenant (not VM-per-client)

The cleaner mental model is **one VM per client**: a client = a VM + a
docker-compose + some DNS. Clean separation, trivial "conductor" (just systemd),
per-client geolocation and vertical scale, dead-simple onboarding (create VM,
pull images, start). That was the original plan.

We went multi-tenant because VMs cost money and we want to try many clients
cheaply — Oracle free tier gives two VMs. Multi-tenant creates real
complications:

- A second docker-compose network per VM.
- A fuzzy split between `clients-router` and each client's `services-router`.
- Onboarding must find a VM with capacity, not just spin up a new one.
- The `qabu-reconciler` daemon exists specifically to keep N client stacks per
  VM converged; VM-per-client would collapse this to plain systemd.

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

Oracle only today (a GCP VM was tried 2026-06 to 2026-07, retired — see § VM
Strategy); Azure possibly later. Goal: **platform portability** — we should be
able to rebuild Qabu on any single cloud in a reasonable time. Scattering
clients across clouds is a side-effect of free-tier limits, not a strategy;
all clients of a given kind should be movable together.

### IPv6 per client (considered, not adopted)

Tempting because IPv6 space is effectively free — one address per client
without buying VMs. But it doesn't actually eliminate the clients-router:
Facebook webhooks, Meta API, and most corporate networks still need an IPv4
front door. The retired GCP IPv6-only VM (§ VM Strategy) proved the hosting
model works, but also proved the IPv4-egress problems (registry pulls, ACME
renewal) aren't worth it for a single demo client — it doesn't remove the need
for a central routing layer.

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
- `/bab/*` — `forward_auth` via auth-verifier sidecar, redirects to Google login
  on 401 (generic authed prefix; the admin lives at `/bab/admin/`)
- `/admin*` — 301 → `/bab/admin...` (back-compat for old bookmarks)
- `/facebook-*` — validates `X-Dispatcher-Secret` header, rejects 403 if missing
- Unknown subdomains → 404 with `X-Qabu: not-found` header

**Services router** (`services/services_router/src/Caddyfile`) — per-client
gateway. Generic routing: `/{service}/...` → `{service}:4321` (prefix stripped).
`/private/*`, `/widget.js`, and `/page/*` are excluded from the generic routing.
- `/taken` → responds "true" (for onboarding subdomain-taken check)
- `/widget.js`, `/widget.css` → widget:4321 (dedicated widget service)
- `/bab/{service}/*` → `{service}:4322` (generic authed: admin, future dashboard, …)
- `/{service}/*` → `{service}:4321` (generic public: prompt-composer, facebook-dm, etc.)
- Everything else (including `/private/*`) → site:80 (static file server)

**Two-port convention** — the `/bab` prefix is only meaningful because of the
port split: **4321 = public** (reachable via the bare `/{service}/*` rule),
**4322 = authed** (reachable only via `/bab/{service}/*`, which the
clients-router guards with `forward_auth`). A service that listens only on
4322 cannot be reached unauthenticated; a service wanting both surfaces
listens on both ports. No allowlists to maintain — the ports are the policy.
Checking `X-Auth-Email` inside a service is NOT a substitute: on non-`/bab`
paths the clients-router passes client-supplied headers through, so the header
is spoofable. And authentication ≠ authorization — `forward_auth` only proves
"some Google account logged in", so every authed service must still check
`X-Auth-Email` against its `authorized_emails` allowlist (as admin does).
New authed service contract: listen on 4322, be named `<name>` in compose, and
you're live at `/bab/<name>/` behind Google login — zero routing changes.

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
`location.pathname.startsWith('/bab/admin')`:
- **Admin**: dynamically loads `admin.js` first (sets `ChatWidgetConfig` overrides
  for draft testing), prefixes fetches with `/bab/admin` (e.g. `/bab/admin/private/...`)
- **Site**: loads the widget directly, fetches from `/private/...`

The visual page (`page/`) uses relative paths (`../private/client-config.json`,
`../private/background.png`) so it resolves correctly under both `/page/` (site)
and `/bab/admin/page/` (admin).

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

**Overlay mode** (the site default): the site iframe fills the whole viewport
(`.container.overlay` CSS hides `.chat-section`) and `loader.js` omits
`targetElement` from `ChatWidgetConfig`, so the widget runs in its native
floating mode — launcher bubble bottom-right (both LTR and RTL), minimize
button, fullscreen under 480px. This showcases exactly what an external
`widget.js` embed looks like on a customer's own site. `?split` opts back into
the side-by-side view (e.g. `drlipokatz.qabu.net/?split`). The **admin**
defaults the other way — split view, because its Facebook test panel overlays
`.chat-section` — and takes `?overlay` to opt in.

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
   `facebook_comments` service format, POSTs to `/bab/admin/ask` with `mod:
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
- Admin chat: browser → client router → forward_auth → services-router `/bab/admin/*` → admin BE `/ask` → prompt-composer
- Site chat: browser → client router → services-router `/prompt-composer/*` → prompt-composer `/ask`
- Initial load: admin BE `/api/initial-content` → prompt-composer `/knowledge_base` + `/system_prompts` + `/greeting`
- KB publish: admin BE `/api/knowledge_base` → prompt-composer `/knowledge_base`
- SP publish: admin BE `/api/system_prompts` → prompt-composer `/system_prompts`
- Services: admin BE `/api/services` → prompt-composer `/services`

### Prompt & Event Logging

After each LLM call, the prompt-composer writes the full request + response to
`logs/last_prompt.json` (overwritten each time). Readable via `GET /last_prompt`
(proxied through admin as `GET /api/last_prompt`). Deliberately global-last, not
per-conversation — it's a "what was just sent" debugging tool, and a
per-conversation variant would persist the full KB once per request.

Each `/ask` also appends **one rich event line** to `logs/events.jsonl` at
request end (outbox pattern — logging is prompt-composer's only record-keeping
duty; storage, aggregation and dashboards live in future consumers):

```json
{"ts": "<append time>", "v": 1, "channel": "<body.mod>",
 "conversation_id": "...", "user_mssg": "<last user message>",
 "errors": ["<failed model attempts, thrown errors>"], "admin": false,
 "gk": "<gatekeeper model>", "skip_gk": true, "ignore": true,
 "main": "<main model>", "res": "<text sent to user>", "error": true,
 "duration_ms": 1234}
```

**The event line is a versioned public API** for consumers (notifier, future
ingester/dashboard): additive-only — add fields freely; never rename, remove,
or repurpose. Every line carries `v: 1`. The shape is declared as a JSDoc
`@type` on `ev` in `server.js`. Always present: `ts`, `v`, `channel`,
`errors`, `admin`, `duration_ms`. The rest appear only when relevant:

- `user_mssg` is **only the current message** (`body.chat.at(-1).content`), never
  the full resent history — a consumer reconstructs a conversation by grouping
  lines on `conversation_id` (see § Request Flags).
- `gk` / `main` are the models that ran each stage. `gk` is absent on
  capability follow-ups (`skip_gk: true` is set instead) and when the
  gatekeeper exhausted all keys (the failures land in `errors`). `main`
  present means the main model produced the reply; `gk` without `main` means
  the gatekeeper answered directly.
- `ignore: true` — the gatekeeper returned `IGNORE`; no `res`, and the HTTP
  response is 204 (see § System Prompts). Logged because it still consumed a
  Groq call — a spam wave stays visible instead of silently burning quota.
- `res` is the reply text actually sent to the user — absent for `ignore` and
  `error` lines.
- `errors` collects per-attempt LLM failures (`"<model> try <i>: <message>"`)
  and any thrown error; `error: true` means the request failed entirely
  (crash, validation, or all retries exhausted) — the event is still appended,
  and the client gets a bare 500 (each FE decides what its user sees).
- `admin: true` — the request carried the `x-admin-secret` header (admin
  draft-test chats, `sp_override`/`kb_override`). Same file as customer
  traffic; consumers filter on the flag. (Until 2026-07-14 these went to a
  separate `logs/admin_events.jsonl` — now orphaned, removed on deploy.)
- `user_mssg`/`res` are full text, no truncation. Nothing truncates the file
  since the notifier (which drained it daily) was disabled 2026-07-16 — growth
  is unbounded, fine at demo traffic, needs rotation before real volume (see
  § Notifier).

There are no per-conversation transcript files — `logs/conversations/` was
removed 2026-07-13; the enriched events carry the full text, and grouping by
`conversation_id` reconstructs any transcript.

### System Prompts

Stored in `clients/<client>/data/system_prompts.js`. Structure (ES module):
`export default { module: { gatekeeper: "...", main: "...", capabilities: "..." } }`.
The prompt-composer loads them via `import` at startup. `main` and `capabilities`
are editable in the admin UI. The `capabilities` key is optional — modules without
it (e.g. `facebook_comments`) don't get capability instructions in their prompt.

The gatekeeper returns **plain text** (no JSON/tool use):
- `IGNORE` → prompt-composer answers HTTP 204 No Content; every FE (widget,
  facebook_comments, facebook_dm) treats 204 as "show nothing". Note `res.ok`
  is *true* for 204 — consumers need an explicit status check, not just `!ok`.
- `ESCALATE` → pass to the main model with full KB
- anything else → send directly as the reply (e.g. a short greeting response)

IGNORE is meant for `facebook_comments` (public threads need silence toward
spam). Widget (and future facebook_dm) gatekeeper prompts should instead
answer off-topic messages with a short polite redirect — see the TASKS.md
prompt-engineering task. The 204 path stays as the seatbelt: if a model emits
IGNORE anyway, the failure mode is harmless silence, never the literal token
reaching a user.

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
- `conversation_id` — stable id for the conversation the request belongs to.
  The prompt-composer stamps it on every `events.jsonl` line; consumers group
  lines on it to reconstruct a conversation (see § Prompt & Event Logging).
  Per channel:
  - **widget** — random UUID minted client-side, kept in `sessionStorage`
    next to `chat_history` (same lifetime: survives reload, regenerated on
    "Clear conversation"). Admin chat uses the same widget, so it's covered.
  - **facebook_dm** — the Graph API conversation id (`t_...`).
  - **facebook_comments** — the level-1 comment id: the L1 thread is the
    conversation unit whose history the service fetches and sends.
  - **mock_facebook** — doesn't send one. Its traffic flows through the real
    facebook_comments service *without* the admin secret, so those test chats
    log as regular events (`admin: false`, no `conversation_id`).

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

**Status: disabled on all clients since 2026-07-16**, pending a redesign (see
TASKS.md). The raw daily digest added no value in practice — Roy checked the
dashboard anyway — and its drain-the-log behavior truncated the dashboard's
history. The service is profile-gated (`profiles: [notifier]` in the client
template and QA compose) and the profile is in no client's `COMPOSE_PROFILES`,
so re-enabling is a one-line config.env change. The code, the `resend_api_key`
secrets, and the Resend/DNS setup below all remain in place. The rest of this
section describes the service as built.

Per-client activity digests by email (`services/notifier/`). Design goal:
prompt-composer stays single-responsibility — it *answers*; it only records
the fact that it answered. The notifier interprets those facts and emails.

**Event log (the API).** prompt-composer appends one rich JSON line per `/ask`
to `logs/events.jsonl` (same `./logs` volume that holds `last_prompt.json`) —
full shape and field rules in § Prompt & Event Logging. Notifier-relevant
points:

- `channel` = `body.mod` (`widget`, `facebook_comments`, `facebook_dm`) — all
  channels covered automatically since everything flows through `/ask`.
- `ignore`d messages are logged too — they still consumed a Groq call; a spam
  wave shows up in the digest instead of silently burning quota.
- Admin-secret test calls land in the **same file**, flagged `admin: true`
  (until 2026-07-14 they went to a separate, never-emailed
  `admin_events.jsonl`). They burn the same Groq/Gemini keys, so they must be
  accounted for — and they now appear in the daily digest; the flag lets any
  reader (and the future ingester) filter them.
- The file is append-only and generic: future event types just add lines with
  new fields; the notifier forwards the raw lines as-is, so no formatting code
  to update. Adding a new notification source means appending JSONL, not
  touching the producer's API.
- Since 2026-07-13 the lines carry full `user_mssg`/`res` text, so the daily
  digest emails were richer *and noisier* — accepted (only Roy read them), but
  it also meant drained events survived only in those emails, which is part of
  why the drain design lost to the dashboard. The long-term plan: a
  `services/dashboard/` ingester owns the file and a redesigned notifier
  queries it.

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
{"ts":"2026-07-14T10:18:00.000Z","v":1,"channel":"widget","conversation_id":"1c9e...","user_mssg":"מתי אתם פתוחים?","errors":[],"admin":false,"gk":"openai/gpt-oss-120b","main":"gemini-3.5-flash","res":"אנחנו פתוחים...","duration_ms":4210}
```

SMTP was rejected because Oracle/GCP block outbound SMTP ports; HTTP POST
from prompt-composer to the notifier was rejected because it couples the hot
`/ask` path to the notifier's existence.

## Dashboard Service

Per-client analytics page (`services/dashboard/`, v0 2026-07-14). Reads
`logs/events.jsonl` and shows simple derived stats: KPI tiles (messages,
conversations, median response, errors), messages-per-day column chart,
channel and outcome splits, with 7/30/all-day filters, an include-admin-tests
toggle, and a refresh button with a relative "last updated" stamp. Clicking
the Messages/Conversations tiles drills down: conversation list (id, start
time, source, message count) → full transcript reconstructed by grouping
events on `conversation_id` (pre-`v:1` lines show "(text not recorded)").
Brand palette, light + dark, no third-party JS.

**Shape.** Express on **4322 only** (authed port) → live at
`https://<sub>.qabu.net/bab/dashboard/` behind Google login with zero routing
changes; authorization is the admin's pattern (`X-Auth-Email` vs the
`authorized_emails` secret — same file as admin, so Roy + Nevo). Mounts are
read-only: `./logs` (events) and `./private` (title from
`client-config.json`). `GET /api/events` normalizes both event schemas — the
pre-`v:1` `{outcome, model}` lines and the `v:1` flag-style lines
(`gk`/`main`/`ignore`/`error`) — into `{ts, channel, conversation_id,
outcome, admin, duration_ms, user_mssg, res}`; the page aggregates
client-side. Compose
profile `dashboard` (opt-in per client, off by default — RAM pressure on the
1 GB client VM).

**Known limits (v0).** Since the notifier was disabled (2026-07-16) the
dashboard sees the full `events.jsonl` history, but nothing rotates the file —
the long-term plan (see TASKS.md) is for this service to own the file (ingest
into SQLite) and a redesigned notifier to query it. UI is English/LTR
regardless of client language.

## Telegram Agent

Per-client Claude Code over Telegram (`services/telegram_agent/`). Roy & Nevo
share one Telegram group per enabled client (Roy + Nevo + `<client>-claude`)
and ask it about that client's logs, events, prompts and KB from a phone
("which model replied just now?", "did anyone write today?").

**Shape.** One container per client, part of the client's docker-compose under
the `telegram` profile (like `site`/`facebook` — most clients won't have it).
Like the notifier it's a pure consumer: no inbound port, it long-polls
Telegram's `getUpdates`. Telegram allows **one poller per bot token**, which
is why instance-per-client forces one BotFather bot per client — that also
gives each group its own named bot member. (QABU-PLAN P1 originally sketched
a single shared bot service; instance-per-client replaced that: simpler trust
boundary — a container can only ever see one client's data — at the cost of a
manual BotFather step per enablement.)

**Read-only, twice.** The agent must not be able to write (client data has no
backups yet) or exfiltrate (logs contain untrusted end-customer text — prompt
injection). Two independent fences:

1. Docker: `data/`, `logs/`, `private/` are mounted `:ro`.
2. Agent SDK: `allowedTools: [Read, Grep, Glob]` and an explicit
   `disallowedTools` for Bash/Write/Edit/WebFetch/WebSearch/Task — no shell,
   no writes, no network egress from the model's hands.

When write support comes, it goes through prompt-composer's admin-secret CRUD
API (same path as admin publish), never raw file writes — plus a
diff-confirmation step in the chat before applying.

**Sessions.** Telegram is stateless; Claude Code sessions aren't. The service
maps `chat_id → session_id` in a JSON file on the `telegram-claude` named
volume (which also holds `/root/.claude` session transcripts), so follow-up
questions keep context across container restarts. Each resumed turn forks a
new session id — the map is updated every turn. `/new` resets a chat's
session.

**Auth.** `data/telegram.json` holds `{"users": [<telegram user ids>]}` —
read per message, so edits apply live. Messages from anyone else are ignored
and logged with their user/chat id (`docker logs` on the container is how you
discover your own id during setup). It lives in `data/`, not `private/`,
because the site serves `private/` publicly. For the bot to see all group
messages, disable BotFather privacy mode (`/setprivacy` → Disable) before
adding it to the group.

**Secrets.** Two per client in `./secrets/`: `telegram_bot_token.secret`
(per-client BotFather token — NOT shared) and `claude_credential.secret`
(shared across clients, lives in `secrets/clients_secrets/` like the other
LLM keys). The credential accepts either flavor and the service auto-detects
by prefix:

- `sk-ant-oat...` — a subscription OAuth token from `claude setup-token`
  (1-year, Pro/Max/Team; inference-only scope). Runs on Roy's Claude
  subscription — no API billing, but shares his rolling usage limits with his
  own Claude Code sessions, and all client bots share the one token. The
  current choice.
- `sk-ant-api...` — a console API key (pay-per-token). The fallback if
  subscription limits pinch, and REQUIRED if this ever becomes customer-facing
  (Anthropic's Agent SDK terms forbid offering claude.ai login/limits in a
  product; internal CI/scripts use via setup-token is the sanctioned case).

The service sets exactly one of `CLAUDE_CODE_OAUTH_TOKEN` /
`ANTHROPIC_API_KEY` on the Agent SDK's `env` option (never the container
environment) — the API key outranks the OAuth token in Claude Code's
credential precedence, so setting both would silently ignore the token.

**Enabling for a client** (manual, like FB page setup):

1. BotFather: `/newbot` → name `<client>-claude`, username
   `<client>_qabu_bot`; then `/setprivacy` → Disable. Save the token.
2. Run `claude setup-token` locally (or create a console API key), then copy
   `telegram_bot_token.secret` + `claude_credential.secret` into
   `~/app/clients/<sub>/secrets/` on the VM.
3. Create the group, add Roy, Nevo and the bot.
4. Send a message, read the ignored-user log line for the user ids, put them
   in `data/telegram.json` (admin has no UI for this yet — known gap).
5. Paste the `telegram-agent` block (from the template compose, without the
   `profiles:` line) into the client's `docker-compose.yml` — the reconciler
   picks it up.

**QA.** One agent in the QA compose (`drlipokatz-telegram-agent`, behind
`docker compose --profile telegram up`) with its own dedicated BotFather bot
(`drlipokatz_qa_qabu_bot`, token in `secrets/clients_secrets/`) — never the
prod token: Telegram allows one poller per token, and QA shouldn't touch prod
integrations (same reasoning as mock-facebook). Telegram is QA-tested on
drlipokatz only; the service is identical across clients.

**Model & cost.** Defaults to `claude-sonnet-5` (override with the
`CLAUDE_MODEL` env var). Every message is an agentic Claude Code turn over
the mounted files — fine for two owners, not exposed to end customers.

## Client Onboarding & Provisioning

### Flow

1. User goes to `qabu.net/onboarding` (public — no auth), enters a subdomain
   name, client validates format
2. "Let's Qabû!" opens an invitation-code popup (experiment phase is
   invite-only); code is checked via public `POST /validate-invite`
3. On a valid code the browser redirects to Google OAuth
   (`/auth/login?return_to=/onboarding/?subdomain=...&invite=...`); back from
   sign-in the page auto-resumes creation
4. `POST /create-client` (the only route behind `forward_auth` in the main
   router) re-validates the invite code server-side, then checks if the
   subdomain is taken (`https://{sub}.qabu.net/taken`)
5. **Demo mode since 2026-07-17** (the scaffolding backend — provisioner +
   conductor — was retired in the reconciler migration; kept deliberately as a
   show-the-idea demo). The page carries an "Under construction" ribbon and a
   live availability check (`GET /available/:sub`, debounced as you type,
   backed by the `/taken` probe). `create-client` still validates auth +
   invite + regex + availability, then answers `503`; the page explains that
   creation is offline. Invite codes are no longer consumed. The retired
   steps used to be: try VMs in order (`v1.qabu.net`, ...) via `POST /scaffold`
   → provisioner validates `X-Provision-Secret` → conductor (Unix socket)
   copies the `config/` template, starts the stack → redirect to `/bab/admin/`.

### Services

- **client-onboarding** (`services/client_onboarding/`) — Express app on main
  server at `qabu.net/onboarding`. Page is public; `create-client` requires
  Google OAuth (Caddy `forward_auth`) + a valid invitation code (replaced the
  old `onboarding_emails` allowlist). Codes are 9-char `[A-Z0-9]`, one per
  line in a bind-mounted `data/invite_codes.txt` (never in git — hand-edited:
  `~/app/data/invite_codes.txt` on the main VM,
  `secrets/main_server_secrets/invite_codes.txt` in QA), **single-use**: the
  service deletes a code from the file after a successful creation. Subdomain
  validation: `^[a-z][a-z0-9-]{3,18}[a-z]$` (5–20 chars).
Retired 2026-07-17 (with the reconciler migration; source deleted, recover
from git history if ever needed):
- **provisioner** — thin proxy on the client VM that forwarded `POST /scaffold`
  to the conductor's Unix socket.
- **conductor** — C++20 systemd daemon that managed the full client lifecycle
  (creation, file watching, reconciliation). Replaced by **qabu-reconciler**
  (see `docs/client-server-setup.md` § Reconciler): an `entr`-based shell
  script whose only job is converging running containers with each client's
  `docker-compose.yml`.

### Client Creation (manual)

Programmatic creation is retired for phase 1 — clients are created by hand on
the client VM:

1. Copy the template: `services/config/files/` → `~/app/clients/<subdomain>/`
   (compose file + `private/` + `data/` defaults; put per-client secrets in
   `secrets/`).
2. Edit `docker-compose.yml`: delete the optional service blocks the client
   doesn't need, drop the `profiles:` line from the ones it does.
3. The reconciler notices the new compose file and brings the stack up.
4. Add the Cloudflare DNS record for the subdomain.

(`services/config/` also builds an init-container image that copied the
template to `~/app/config/` on the VM for the conductor's create flow — no
longer deployed, but the image/template stays as the source for manual copies.)

### Docker Compose Profiles (template only)

Since the reconciler runs plain `docker compose up -d` (no `--env-file`, no
`COMPOSE_PROFILES`), profiles no longer select services at runtime. They
survive only in the **template** compose file as an off-by-default marker:
a `profiles:` key means "this block won't run as-is; delete the line to
enable it". Deployed client compose files are materialized — they contain
exactly the services that run. `private/config.env` still exists on the VM
but is inert; the admin "Manage Services" button edits it to no effect and
needs a redesign (see TASKS.md).

### Subdomain Validation

`^[a-z][a-z0-9-]{3,18}[a-z]$` (5–20 chars), in onboarding (`SUBDOMAIN_RE`).
(The conductor's duplicate `valid_sub()` went away with the conductor.)

## Secrets

Secrets are organized by scope:

- `secrets/client_router_secrets/` — clients-router VM (TLS, JWT, dispatcher)
- `secrets/clients_secrets/` — shared per-client (LLM API keys, admin secret, authorized emails, Resend API key)
- `secrets/main_server_secrets/` — main server (OAuth, FB app, JWT, dispatcher, onboarding)

The `secrets/` directory in the repo is used by the QA docker-compose only. In
production, secrets are copied manually to each VM. Future plan: Infisical.

Shared secrets that must match across VMs:

| Secret                 | Used by                                    |
|------------------------|--------------------------------------------|
| `jwt_signing_key`      | Auth (main) + auth-verifier (client)       |
| `fb_dispatcher_secret` | Facebook dispatcher (main) + clients-router|
| `cloudflare_api_token` | TLS on both VMs                            |

(`provision_secret` — onboarding (main) + provisioner (client) — retired with
the provisioner, 2026-07-17.)

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

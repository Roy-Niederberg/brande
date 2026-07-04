# Qabu

Qabu (from Akkadian "to say/speak") is a RAG-based AI agent platform for small
businesses. Clients get a site at `<name>.qabu.net` with an AI chat that answers
customer questions from a knowledge base, plus a widget, Facebook, WhatsApp and
more.

- Owners: Roy & Nevo, based in Israel. Domain: `qabu.net` (registered on GoDaddy, DNS on Cloudflare).
- Infra: Two VMs, both Oracle — one main + one clients. Docker everywhere. See
  `docs/architecture.md` § VM Strategy.
- Repo: Private GitLab (`origin`), mirrored to GitHub (`github` remote).
- Email: inbound `privacy@qabu.net` → Cloudflare Email Routing → `roy.niederberg@gmail.com`.
  Outbound via Resend API (`notifications@qabu.net`, qabu.net verified, SPF/DKIM on
  `send.` subdomain in Cloudflare) — used by the notifier service.

## GitHub Mirror (Claude Code Mobile)

Claude Code on mobile works with GitHub. The GitHub repo is a mirror — GitLab
is the single source of truth. Never merge on GitHub UI.

**The mirror is automatic.** GitLab push-mirrors `main` to GitHub, so pushing to
GitLab (`git push origin`) syncs GitHub on its own. Never `git push github`
manually — there's no need, and the `github` remote isn't required for the
mirror direction.

When Claude Code on mobile creates a branch on GitHub, pull it back into GitLab:
```sh
git fetch github                                    # 1. fetch new branches
git branch -r --list 'github/*'                     # 2. see what's new
git diff origin/main...github/<branch>              # 3. review changes
git merge github/<branch>                           # 4. merge into main
git push origin                                     # 5. push to GitLab → auto-mirrors to GitHub
git push github --delete <branch>                   # 6. delete the GitHub-only branch
```
Step 6 is the **one** legitimate direct push to GitHub: that branch exists only
on GitHub, so the mirror (GitLab→GitHub only) never sees it and can't clean it
up. This is cleanup, not the routine sync.
(Steps 1 and 6 need the `github` remote: `git remote add github
git@github.com:roy-niederberg/brande.git`.)

## Setup (new machine)

Install each plugin listed under `enabledPlugins` in `.claude/settings.json`
via `/plugin install <name>` (currently: `typescript-lsp@claude-plugins-official`).

Local skills live in `.claude/skills/` (checked into the repo via a whitelist
`.gitignore`) and are auto-discovered — no install step needed.

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

All tasks live in `TASKS.md`. Tag with ownership (`[roy]`, `[claude]`, `[both]`)
and phase from `QABU-PLAN.md` (`[P0]`–`[P4]`, `[defer]`, `[goal]`, `[when-X]`).
See the Priority section in `TASKS.md` for what each phase tag means. Delete
tasks when done — git history is the audit trail.

Each task must be **very detailed** with full context so Roy can recall what
it's about later. Include:
1. The conversation context that led to the task (e.g. "While discussing X, we
   realized Y because...")
2. Why it matters / what problem it solves
3. Date of creation in parentheses at the end, e.g. `(added 2026-03-13)`

Roy uses this file as a backlog across conversations. Without context, tasks
become cryptic reminders that are hard to act on weeks later.

Whenever a conversation surfaces something that should be done later (Roy says
"I need to...", "we should...", "add a task for...", or a TODO naturally emerges
from the discussion), proactively write it to `TASKS.md` and mention that you
did.

## Dev Philosophy

- Short, simple code. Aim for ~80 line files, ~100 char lines.
- Every line must justify its place. Avoid unnecessary abstractions.
- **No environment-specific values baked into source.** Never hardcode usernames,
  home directories, absolute host paths, IPs, ports, or hostnames that vary by
  machine/user into code. Derive them at runtime (`$HOME`, `getpwuid`, env vars,
  `process.cwd()`) or pass them in via config/args/compose. The code must run
  unchanged as any user on any host. (Cautionary tale: the conductor compiled
  `/home/brande/app/...` into its C++ constants, binding the binary to one
  username — renaming the user would have meant a recompile. Don't repeat that.)
- Minimize third-party dependencies.
- Whitelist `.gitignore` (not blacklist).
- Everything runs in Docker - no node/npm/python on the host.
  To generate/regenerate `package-lock.json` for a service (since npm isn't on
  the host), run from the repo root:
  ```sh
  docker run --rm -v "$(pwd)/services/<service>/src/package.json:/app/package.json" \
    -w /app node:22-alpine \
    sh -c "npm install -g npm@latest >&2 && npm install >&2 && cat package-lock.json" \
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

## Brand Name

Write **Qabû** (with the circumflex) in user-facing text — page titles, buttons,
headlines, marketing copy, both EN and HE. Plain `qabu` stays in domains, code,
paths, and identifiers.

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
Admin buttons intentionally use simpler colors (not brand colors) for separation.

## Express Async Error Handling

Express doesn't catch errors thrown in `async` route handlers. We use `app.r`
to wrap handlers with try/catch and forward errors to the error middleware:

```js
app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{ await f(rq,rs,nxt)} catch(e) {nxt(e)}})
```

Use `app.r('get', '/path', handler)` instead of `app.get('/path', handler)`.
Thrown errors hit the error middleware at the bottom of the file (logs + 500).

## Source of Truth

Two kinds of state, two different sources of truth:

1. **Generic code** — not client-specific. Lives in **git**, developed locally,
   deployed via Docker images (build/push from local, pull on the VM).
2. **Per-client data** — config, prompts, KB, assets. Lives on the **client VM**,
   edited via the admin panel. The VM's volume is authoritative.

For local dev or inspection, `rsync_clients.sh` pulls each client's `private/`
and `data/` from the VM back into `clients/<sub>/` on the local machine. This
direction is **read-only-for-development** — never the other way around.

### Known violations of the desired state

This split is the goal, not the current reality. Active problems, in priority
order:

1. **No backups for client data.** If a client's admin nukes their KB, prompts,
   or config, it's gone. The VM volume is authoritative *and* unprotected.
   Highest-priority fix.
2. **No version history / rollback for published changes.** The admin publish
   flow overwrites the live file. Drafts exist in localStorage, but once
   published there's no "previous version" anywhere.
3. **No audit log.** Multi-admin clients will eventually want who-changed-what.
4. **`clients/` is checked into git.** Committed clients (drlipokatz, eintal,
   eintal-hadassah, dradamblack, yomialpurrer, aram-ent) all have
   copies that drift from the VM. Onboarding-created clients (the new flow) correctly don't
   enter git — but eintal-hadassah (added 2026-06) was built repo-first and
   scaffolded/pushed to the VM by hand rather than via onboarding, so it joined
   the committed group deliberately (we pre-built its KB + prompts locally).
   Long-term, `clients/` should be gitignored and only the template
   (`services/config/files/`) stays in git.
5. **Admin UI gaps force git+rsync edits** for things that should be
   admin-editable: background images, og-meta, capabilities (`run()` logic is
   code, but the list of available capabilities should be selectable),
   `client-config.json` fields, `config.env` toggles beyond `COMPOSE_PROFILES`.
   Every gap here is a reason someone has to bypass the admin and touch git.
6. **`system_prompts.js` and `capabilities.js` straddle the line.** They're JS
   modules (code-shaped) but `system_prompts.main`/`capabilities` text is
   edited via admin. Acceptable for now, but worth keeping in mind when
   touching the loader.

### Rule for future changes

**Don't make the split worse.** Before adding a feature, ask:
- Is this generic code or client data?
- If client data: is it editable in the admin? If not, the feature ships with
  a known gap that forces git+rsync. Either build the admin UI or accept the
  debt explicitly.
- If you're tempted to commit a client-specific file to git as a workaround,
  stop — that's exactly what we're trying to get away from.

## Project Structure

```
clients/                    - Per-client data, checked into git
  <subdomain>/
    private/                - Client config & assets (client-config, background, og-meta, mock_facebook/, config.env)
    data/                   - Prompt-composer config (system_prompts.js, knowledge_base.json, etc.)
    logs/                   - System output (last_prompt.json)
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
    files/                  - Default files for a new client (private/, data/, docker-compose.yml)
docs/                       - Operational guides + architecture reference
  architecture.md           - Deep reference: VMs, routing, admin/site UI, capabilities, widget, onboarding, secrets, Facebook
  images/                   - Images for the project
  client-server-setup.md    - How to provision a new client VM from scratch
clients_server_automation/  - Host-level automation on the client VM
  conductor/                - systemd daemon that manages client lifecycle
```

**Where things go:** `CLAUDE.md` is for *what to do* — instructions, conventions,
workflows, and frequently-needed operational facts; keep it lean (the harness
warns past ~40k chars). `docs/architecture.md` is for *how it's built* — deep
reference read on demand. New "how it works" detail goes in `docs/`, not here.

## VM Strategy

Two VMs, both Oracle:

- **Main** (Oracle, `brande@129.159.134.3`) — singleton. Landing page, auth,
  FB dispatcher, onboarding. Scales vertically.
- **Clients #1** (Oracle, `brande@129.159.159.251`) — multi-tenant: drlipokatz,
  eintal, eintal-hadassah, yomialpurrer, dradamblack, aram-ent.

A second, GCP IPv6-only clients VM (`Clients #2`) hosted the `ofirfichman` demo
client from 2026-06 to 2026-07-04; retired because it created more operational
problems (IPv6-only egress/cert headaches, see the retired TASKS.md items) than
value as a single demo client. Multi-cloud is still the long-term goal to avoid
single-vendor lock-in — see `docs/architecture.md` § VM Strategy — just not
active today.

Multi-tenant (not VM-per-client) is a cost concession, not the ideal — it
creates the **clients-router ↔ services-router tension**: clients-router does
cross-cutting concerns only (TLS, admin `forward_auth`, dispatcher secret,
rate limits); services-router does per-client URL routing only. If a feature
blurs that line, that's the signal to reconsider VM-per-client, not to add glue.
Full rationale (multi-cloud, IPv6, conductor) in `docs/architecture.md` § VM Strategy.

## Running the QA Environment

The QA environment simulates both production VMs in a single Docker Compose.
To support the qa environment, Cloudflare DNS is configured (DNS only, grey cloud):
- `qa.qabu.net` → `127.0.0.1`
- `*.qa.qabu.net` → `127.0.0.1`

And GCP OAuth has `http://qa.qabu.net:8080/auth/callback` as redirect URI.

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

`services/build.sh` builds and pushes a single service image to the GitLab
registry, multi-arch (`linux/amd64` + `linux/arm64` — for ARM client VMs). It
lives inside `services/` so service-name tab completion works naturally
(service directories are its siblings).

```sh
services/build.sh <service>             # e.g. services/build.sh prompt_composer
services/build.sh -t <tag> <service>    # also tag with <tag>
```

For each build it:
- Runs `docker buildx build --target production --platform linux/amd64,linux/arm64 --push`.
  Multi-platform builds can't load into the local image store, so build+push
  happen in one step (unlike a plain `docker build`).
- Labels the image with `org.opencontainers.image.revision=<full SHA>`.
- Tags and pushes `latest` + `<short SHA>` (and `<tag>` if `-t` is given), as a
  single multi-arch manifest list per tag — `docker compose pull` on either an
  x86 or ARM VM automatically grabs the matching layer.
- Self-heals QEMU arm64 emulation: checks
  `/proc/sys/fs/binfmt_misc/qemu-aarch64` and re-registers it (via
  `docker run --privileged --rm multiarch/qemu-user-static --reset -p yes`) if
  missing — this registration doesn't survive a host reboot.

**One-time per machine**: `docker buildx create --use --bootstrap` (creates a
`docker-container` buildx builder backed by a BuildKit container — persists
across reboots, `build.sh` doesn't need this repeated). Base images
(`node:22-alpine`, `caddy:2.10.2-alpine`) are already multi-arch, so no
Dockerfile changes are needed for arm64 support.

Cross-arch builds are QEMU-emulated, not native — fine for these light
services (`npm ci` ran ~6x slower under arm64 emulation but still <20s), but
worth watching if a service's dependency tree grows heavy. If emulation ever
becomes the bottleneck, the next step up is a native ARM buildx builder node
over SSH to a real ARM box, not more emulation tuning.

The build/deploy flow has changed a lot and will keep changing — treat this
section as a snapshot of what exists now, not a long-term contract.

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
(Docker, conductor, clients-router, secrets, DNS). See `docs/architecture.md`
§ VM Strategy for the hosting rationale.

## Repo Scripts

Five shell scripts live at the repo root, all run from a local dev machine:

- **`setup_server.sh`** — base host setup for a **new** Oracle VM (run once, before
  the steps in `docs/client-server-setup.md`). Takes `<cloud-user>@<host>` (e.g.
  `ubuntu@1.2.3.4`), SSHes in, and provisions the `brande` user (password-sudo +
  your SSH key + docker group), makes `ufw` the sole firewall owner (22/80/443,
  purging Oracle's stock iptables), and installs Docker. Idempotent; prompts
  interactively for the `brande` sudo password at the end. Does NOT do role setup
  (registry login, conductor, clients-router) — that's the rest of the doc.

- **`check_main.sh`** — health-checks `qabu.net` endpoints: landing page, static
  assets, `/privacy`, `/terms`, `/auth/*`, `/onboarding`, `/facebook` dispatcher,
  HTTP→HTTPS redirect, content sniff, TLS cert expiry (warns under 14 days),
  and a single admin `forward_auth` canary via `drlipokatz.qabu.net` (covers
  the cross-VM auth chain). Run after main-server deploys.

- **`check_clients.sh`** — iterates every directory under `clients/` and checks
  `widget.js` (status + JS content-type, catches mis-routing), `/taken` (proves
  services-router is alive), and `/` (warn-only, since site profile may be off).
  Run after client-VM deploys or when adding a client.

- **`rsync_clients.sh`** — pulls each client's `private/` and `data/` from the
  client VMs back to the local `clients/<sub>/` directory. Currently runs with
  `--dry-run` by default — drop the flag to actually copy. This is the
  read-only-for-development escape hatch from the **Source of Truth** section
  above; the VM is authoritative, local is a snapshot for inspection. Don't
  push the other direction.

- **`check_versions.sh`** — for each VM (main + both client VMs), prints a table
  of running containers with their git SHA (from the
  `org.opencontainers.image.revision` label set by `services/build.sh`), image
  build date, status, and image. Run after a deploy to confirm every VM picked
  up the new image. Empty SHA column = image was built before `build.sh` started
  labeling, or built off-flow.

When adding a new client VM or subdomain, the four fleet scripts (`check_main.sh`,
`check_clients.sh`, `rsync_clients.sh`, `check_versions.sh`) need updating
(`rsync_clients.sh` per-client list especially — it's hand-maintained;
`check_versions.sh` has a per-VM list at the top). `setup_server.sh` is generic
and takes the target as an argument, so it needs no per-VM edits.

## Landing Pages

There are two landing-page services, each a separate Docker service on the main
server:

- **English** — `services/landing_page/` (React/Vite/Tailwind), served at the
  `qabu.net` catch-all (`landing-page:80`).
- **Hebrew** — `services/landing_page_hebrew/` (static `index.html` + nginx),
  served at `qabu.co.il` (`landing-page-hebrew:80`).

**Always build with `services/build.sh`** — never a bare `docker build`/`docker
push`. build.sh tags `:latest` *and* `:<short-SHA>` and stamps the
`org.opencontainers.image.revision` label that `check_versions.sh` reads. A
manual `docker build -t ...:latest` skips the SHA tag and the label, so the VM's
running image becomes untraceable (empty SHA column in `check_versions.sh`).
Because build.sh reads `git rev-parse HEAD`, **commit your changes first** so the
label points at the commit whose content is actually in the image.

```sh
services/build.sh landing_page          # English (qabu.net)
services/build.sh landing_page_hebrew    # Hebrew (qabu.co.il)
```

Deploy (service name = `landing-page` or `landing-page-hebrew`):
```sh
ssh brande@129.159.134.3 'cd ~/app && docker compose pull landing-page && docker compose up -d landing-page'
```

Routing: the main router Caddyfile proxies the `qabu.net` catch-all to
`landing-page:80` and `qabu.co.il` to `landing-page-hebrew:80`. `/privacy` and
`/terms` are still served from `/srv` as static files.

Static assets (videos, images) for the English app go in
`services/landing_page/public/` — Vite copies them to `dist/` as-is during build.

## Client Config & Assets

Each client has a `client-config.json` in `clients/<client>/private/` that
configures language, direction, title, background image, social links, and
`profilePic` (base64 data URI). The profile pic is embedded in the config as a
data URI — no separate image file. The widget receives it via `ChatWidgetConfig`
and falls back to the Qabu logo SVG if not provided.

Each client also has a `mock_facebook/` subfolder in `private/` with
`post-data.json` (and optionally `post-image.jpg`) for the mock Facebook admin
testing interface.

## Client Profiles

All seven clients are demos. None are paying customers yet.

**eintal** — Prospective first real customer. Real multi-doctor clinic, currently
running as a demo against their real site. The headline feature being demoed is
**multi-doctor routing**: Qabu gathers what the patient needs and directs them to
the right doctor. The candidate doctors today are `drlipokatz` (cataract surgeon)
and `yomialpurrer` (fictional — placeholder for a second specialty). If eintal
converts, those placeholders get replaced with their actual roster.

**drlipokatz** — Hebrew demo client. Cataract surgery clinic (ד"ר ליפו כץ) —
**fictional doctor**. Modeled after Nevo's master spec (`Nevo.txt`) with 15
consolidated intents (`intent.md`). KB has 12 entries covering the cataract
patient journey. Doubles as a referral target for eintal's routing demo. Key
prompt design patterns:
- **Slot tracking** (prompt-only, no code): the main SP instructs the LLM to
  gather 5 data points naturally (topic, not emergency, HMO, insurance, readiness)
  before showing a booking link. At least 3 must be known.
- **Emergency guardrails**: both gatekeeper (ESCALATE) and main prompt detect
  emergency symptoms (sudden vision loss, severe pain, flashes, dark spots,
  curtain sensation) and respond with ER referral — no booking offered.
- **Tiered CTAs**: soft CTA for educational questions, HMO question for cost
  queries, direct booking CTA for surgery-ready users.

**yomialpurrer** — Hebrew demo, **fictional doctor**. Second specialty option for
eintal's multi-doctor routing demo. Paired with `drlipokatz`. Deployed on the
Oracle client VM (`129.159.159.251`).

**dradamblack** — English demo client. Cataract surgery clinic (Dr. Adam Black —
**fictional doctor**). English translation of `drlipokatz` with US medical context
(insurance instead of HMO, USD instead of ILS, NY address). Same prompt design
patterns, same KB structure. Exists so English-speaking prospects can see Qabu
in their language. Deployed on the Oracle client VM (`129.159.159.251`).

**eintal-hadassah** — Hebrew demo client for the **refractive / glasses-removal
(laser) surgery** branch of Ein Tal, modeled on the real site
`eintal-hadassah.com` (an Ein Tal × Hadassah Ein Kerem collaboration). Site-only
(no Facebook), with the basic template gatekeeper + main prompts and a starter KB
seeded from the clinic site (LASIK/INTRALASIK/PRK, branches, surgeons, HMO
agreements) — a placeholder for Nevo to fill in. Site iframe points at
`eintal-hadassah.com` via `client-config.json` `siteUrl`. Deployed on the Oracle
client VM (`129.159.159.251`) and featured as a live-agent card on the Hebrew
landing page (`qabu.co.il/#examples`). A sibling clinic of eintal, not one of
eintal's routed specialists.

**aram-ent** — Hebrew demo for **א.ר.ם**, a real private multi-specialty ENT /
head-and-neck / oral-maxillofacial medical center, running as a demo against
their real site (`aram-ent.co.il`, set as `siteUrl`). Site-only (no Facebook).
KB (11 entries), system prompts, greeting and og-meta were rebuilt 2026-07-03
from the real site — clinic info, branches, doctors, URG.ENT urgent-care center,
HMO arrangements — pending Nevo's review (see TASKS.md). Added by hand on the
Oracle client VM (`129.159.159.251`), not via onboarding: the VM was already at
the conductor's `MAX_TIER` capacity cap (also in TASKS.md).

## Caddy Routing

Four Caddyfiles route across the two VMs: **main router** (`services/main_router/`,
main VM — `/facebook*`, `/auth/*`, `/onboarding*`, static `/privacy` `/terms`,
catch-all → landing-page), **clients router** (`services/clients_router/`, client
VM — `*.qabu.net` → per-client services-router, `/admin/*` `forward_auth`,
`/facebook-*` dispatcher-secret check, `/scaffold` → provisioner), **services
router** (`services/services_router/`, per-client — generic `/{service}/*` →
`{service}:4321` prefix-stripped, `/widget.js` → widget, everything else → site:80),
and **site Caddyfile** (`services/site/`, serves `ui` volume + `private/`).
Full per-route tables in `docs/architecture.md` § Caddy Routing.

## Admin & Shared UI

The admin and site share the exact same HTML shell, loader, and visual `page/`
(**WYSIWYG**). The admin Docker image owns these files and copies them to the `ui`
volume on startup; site mounts that volume read-only. `loader.js` detects admin
vs site via `location.pathname.startsWith('/admin')`. `admin.js` injects the
editor overlay (six buttons: Edit KB, Edit System Prompts, Edit Greeting, See
Prompt, Test Facebook Comments, Manage Services) with localStorage drafts +
publish flow. Admin→prompt-composer trust is a shared `admin_secret` header that
gates `sp_override`/`kb_override`. Auth is centralized Google OAuth (`services/auth/`
on main, JWT cookie on `.qabu.net`, `auth-verifier` sidecar on client VM).
The gatekeeper returns plain text: `IGNORE` (drop), `ESCALATE` (→ main model with
full KB), anything else (use as the reply). Full details — layout, request flows,
prompt logging, system-prompts structure, rate limiting, RTL — in
`docs/architecture.md` §§ Shared UI / Admin.

## Capabilities, Widget, Onboarding, Secrets, Facebook

These are reference-heavy — see `docs/architecture.md` for full detail:

- **§ Capabilities (LLM Tool Use)** — per-client `data/capabilities.js`, the
  `|| ACTIONS` block protocol, `run()` returning `{result, continue}`, results
  auto-sent back with `skip_gk: true`, `canvasElement` for capability UI. Also
  covers prompt-composer's `$`-object data loading + crud GET/POST endpoints.
- **§ Widget Service** — `services/widget/` serves `widget.js` on 4321 to site,
  admin, and external embeds; talks straight to prompt-composer; config options.
- **§ Notifier Service** — per-client `services/notifier/` emails a once-a-day
  raw digest via Resend (key: `resend_api_key` secret); sends the new lines of
  `logs/events.jsonl` (appended by prompt-composer) verbatim, no parsing. No
  inbound port; drains the log by renaming it to `events.sending` and deleting
  that only after a successful send (failed sends retry next cycle). Recipients
  in `data/notify.json` — in `data/`, not `private/`, because site serves
  `private/` publicly.
- **§ Telegram Agent** — per-client `services/telegram_agent/`: Claude Code in a
  container, one Telegram group per enabled client (Roy + Nevo + `<client>-claude`),
  for asking about logs/events/KB from a phone. Profile `telegram`, one BotFather
  bot per client (Telegram allows one poller per token), read-only (`:ro` mounts +
  Read/Grep/Glob only). Allowed user ids in `data/telegram.json`. Future writes go
  via prompt-composer admin CRUD, with in-chat diff confirmation.
- **§ Client Onboarding & Provisioning** — onboarding → provisioner → conductor
  flow, the `config/` template, Docker Compose profiles (`site`, `facebook`,
  `telegram` — core services have none), subdomain regex
  `^[a-z][a-z0-9-]{3,18}[a-z]$` (must stay in sync between onboarding and
  conductor).
- **§ Secrets** — `secrets/` layout (client_router / clients / main_server scopes),
  and the cross-VM shared secrets that must match (`jwt_signing_key`,
  `fb_dispatcher_secret`, `provision_secret`, `cloudflare_api_token`).
- **§ Facebook Integration** — centralized dispatcher on main routes webhooks by
  page ID (`page_routes.json`) to `{client}.qabu.net/facebook-{dm|comments}`;
  HMAC verify in, `X-Dispatcher-Secret` out; the per-client FB services.

## Gotchas

- YAML flow mappings `{file: ...}` break with `${VAR}` inside — use block style
  instead.
- `client-config.json` in `private/` controls `backgroundImage` — must match actual
  filename.
- Panels hidden with `display:none` break `scrollHeight` — run `autoResize` on
  open.
- `.prompt` has `overflow-y:auto` which scrolls padding (was an issue when log
  panel used flex layout).

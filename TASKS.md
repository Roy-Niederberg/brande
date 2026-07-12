# Tasks

Open tasks for Qabu. Ownership tags: `[roy]`, `[claude]`, `[both]`. Phase tags
from `QABU-PLAN.md`: `[P1]`–`[P4]`, plus `[defer]` for out-of-window, `[goal]`
for north-star outcomes, `[when-X]` for conditional. Delete tasks when done —
git history is the audit trail, this file is the working backlog.
New tasks should follow CLAUDE.md's "Task Management" rules: rich context, why
it matters, date in parens at the end.

## North Star

High-level direction, not directly actionable. Most concrete work below is in
service of one of these.

- [both] [P0] **Backup client data** — VM is the source of truth (see CLAUDE.md
  "Source of Truth"); without backups a single bad admin edit is unrecoverable.
  Highest-priority infra gap.
- [both] [P2] **Better chat logging** — production-grade conversation logs (per
  client, queryable, retained) for debugging, prompt iteration, and eventually
  customer-facing transcripts.
- [roy] [goal] **Give Nevo the MVP** — the sign-off milestone for "v1 done."
- [roy] [P4] **Finish self-onboarding** — `qabu.net/onboarding` exists and works
  for the happy path; the long tail (DNS automation, error UX, capacity rules,
  Cloudflare records) is what's left. (DNS automation is split out as its own
  P1 task below.)
- [roy] [P2] **Qabu as an employee with personality** — the product vision: not
  just a Q&A bot, an agent that initiates, follows up, has identity.
- [roy] [defer] **Network of agents** — beyond gatekeeper + main, design the
  multi-agent topology (router, specialist, escalation, etc.).
- [both] [P2] **Local integration test environment** — Docker network with
  service containers + wiremock + browser container (noVNC, since host is
  Wayland). Keeps coming up; invest once enough end-to-end flows justify it.
  (added 2026-03-28)

## Priority

Tasks are tagged with a phase from `QABU-PLAN.md` (the 6-month plan to reach
90% of `QABU-VISION.md`):

- `[P0]` — **Phase 0 (weeks 1-8): Eintal Live on FB.** Get eintal answered
  by Qabu on FB comments + DMs, manually billed via Nevo. Two top-top
  priorities: (1) admin works perfectly for Nevo, (2) FB comments + DMs
  reliably correct. Plus ARM migration, backups, real eintal KB.
  **#1 priority — everything else waits.**
- `[P1]` — **Phase 1 (weeks 9-12): Foundation polish.** Version history,
  Telegram bot scaffold, Layer 3 validator, multi-channel test harness.
- `[P2]` — **Phase 2 (weeks 13-18): Owner relationship + Heartbeat.** Layer 4
  escalation, conversational admin chat alongside the 6 buttons, heartbeat
  scheduler. **Phase gate: second paying client by week 18.**
- `[P3]` — **Phase 3 (weeks 19-24): Customer canvas + Commerce.** Canvas
  component library, Stripe billing (migrate eintal off manual), Facebook
  login, per-client rate limits/tiers, prompt-quality polish.
- `[P4]` — **Phase 4 (weeks 25-30): Dogfood + Polish.** Conversational
  onboarding, `q.qabu.net`, error UX, slug hardening real fix, security
  hardening.
- `[defer]` — Out of the 7-month window. Still on the list, just not now.
- `[when-X]` — Conditional, fires on a specific event.
- `[goal]` — North-star outcome, not phase-bound.

Do P0 before P1 before P2 before P3 before P4. Respect the Phase 2 gate — no
Phase 3 work until there's a second paying client.

## Open

- [roy] [P4] **Revoke the unused GitLab deploy token** (`docker-login-for-server`,
  username `gitlab+deploy-token-9617691`). While auditing which credential the
  VMs use for `docker login registry.gitlab.com` (2026-07-06 conversation), we
  confirmed both VMs use the *other* deploy token (`docker-login-deploy-token-for-server`,
  custom username `brande`, `gldt-` prefix in `~/.docker/config.json`). The
  first token was presumably an initial attempt from the same day (both created
  Oct 24, 2025), is used by nothing, and never expires — a dangling credential
  whose only kill switch is revocation. Revoke it in GitLab: Project → Settings
  → Repository → Deploy tokens. Optional extra (nice-to-have, same screen):
  issue one deploy token per VM instead of sharing one, so a compromised VM can
  be cut off without breaking pulls on the other. (added 2026-07-06)

### Source of Truth & client-data lifecycle

- [both] [P0] **Replace the MVP backup with a proper `services/backup/` Node
  service.** An MVP is live on the Oracle client VM: a systemd *user* service
  (`qabu-backup.service`, `Restart=always`, linger enabled — survives reboot)
  running `find clients/*/{data,private} -type f | entr -dn ...`, which rsyncs
  into a cloned GitLab repo (`rny3/qabu_clients`) and commits + pushes on every
  change. SSH deploy key at `~/.ssh/qabu_backup`, write-enabled in GitLab. The
  automation is checked into `clients_server_automation/backup/`. It now covers
  every client on the Oracle VM (drlipokatz + eintal) and survives reboot, but:
  (a) needs `entr` and `git` installed on the host, violating the
  everything-in-Docker rule; (b) no debounce — a burst of admin saves yields
  multiple commits.

  **Why:** unprotected client VM volumes are CLAUDE.md "Source of Truth"
  gap #1. The MVP unblocks signing eintal as the first paying client without
  a multi-day infra detour, but it's not the long-term answer.

  **Design we sketched (2026-05-19 conversation):**

  1. **Restructure first** — move `data/` and `private/` under a single
     `state/` bucket per client: `clients/<sub>/state/{data,private}/`.
     `logs/`, `secrets/`, and `docker-compose.yml` stay outside `state/`.
     Touches: `services/config/files/docker-compose.yml` (4 volume mount
     lines), the template tree (`git mv`), `clients_server_automation/conductor/src/main.cpp`
     (5 path references), `rsync_clients.sh`, CLAUDE.md, and a one-shot
     migration script for each existing client on each VM. Service-side
     container paths (`/app/data`, `/app/private`, `/site/private`) stay
     unchanged — only the host side of the mount moves. Ship and verify
     this *before* writing the new service so debugging stays untangled.

  2. **Then `services/backup/`** — Node + `chokidar` (inotify) in a Docker
     container, deployed as shared infra alongside `clients-router` and
     `auth-verifier` in each client VM's `docker-compose.yml`. Mounts:
     `~/app/clients:/clients:ro` (whole tree, read-only), a named volume
     for the local git workdir, SSH deploy key + known_hosts as Docker
     secrets. Image base `node:22-alpine` + `apk add git openssh-client` —
     git stays inside the container, host stays dep-free. Logic: debounce
     ~30s on chokidar events, rsync `/clients/*/state/` → local repo
     `/state/<vm-id>/...`, then `git add -A && commit && push`. Per-VM
     subdirectory in one shared repo so multi-VM pushes never conflict.
     Separate deploy key per VM (revocable independently). Add a daily
     heartbeat commit so silent watcher death is visible in `git log`.

  3. **Migration off the MVP** — once `services/backup/` is running, tear
     down the tmux loop on eintal's VM, `apt remove entr git`, delete the
     `~/.ssh/qabu_backup` key + GitLab deploy key, push to the same
     `qabu_clients` repo from the new service. No data migration needed —
     the new service produces an isomorphic tree.

  **Sequencing constraint:** don't combine the restructure and the new
  service into one PR — debugging "is this broken because of the
  restructure or the new service?" gets painful. Restructure → verify all
  clients still serve → then build the service.

  Tied to CLAUDE.md "Source of Truth" gap #1 (backups), partially addresses
  gap #2 (the git history gives basic version history / rollback for free).
  (added 2026-04-19, MVP shipped & task rewritten 2026-05-19)
- [roy] [defer] **Decide what happens to demo clients currently in git**
  (`dradamblack`, `drlipokatz`, `eintal`, `yomialpurrer`).
  Either keep them as seed fixtures under `services/config/files/` or `seeds/`,
  or remove them from git entirely and re-seed in QA from the template. Tied
  to CLAUDE.md "Source of Truth" gap #4. (added 2026-04-19)
- [roy] [defer] **Install Claude Code in Docker on the client VM** with a
  narrow mount scope (only `~/app/clients/<sub>/data` + `private/`) and a
  container-local CLAUDE.md restricting it to KB/SP edits. Stepping stone
  toward LLM-assisted editing for owners. (added 2026-04-19)
- [roy] [defer] **Add admin UI for the gaps** that currently force git+rsync
  edits: background images, `og-meta.html`, capability selection,
  `client-config.json` fields, `config.env` toggles beyond `COMPOSE_PROFILES`.
  Each gap is a reason someone bypasses the admin and touches git. Tied to
  CLAUDE.md "Source of Truth" gap #5.

### Prompt engineering

- [claude] [defer] **Fix trailing SLEEP action in LLM responses.** The LLM
  sometimes appends a standalone `|| SLEEP 2500` as the last action with
  nothing after it. Capabilities instructions teach the SLEEP→CONTACT_FORM
  pattern; the model over-applies SLEEP as a generic "let user read" signal.
  Harmless but wasteful (2.5s pointless pause). Clarify in the capabilities
  section that SLEEP is only valid before another action. Suggested wording:
  "השתמש ב-SLEEP רק לפני פעולה נוספת (כמו CONTACT_FORM) כדי לתת למשתמש זמן
  לקרוא. אל תשתמש ב-SLEEP כפעולה אחרונה — אין בכך תועלת."
  Use the `qabu-prompt-engineer` skill.

- [claude] [P3] **Optimize system prompts for Gemini (dradamblack +
  drlipokatz).** Apply to both clients. Use `qabu-prompt-engineer-gemini`
  skill.
  - Add 2-3 few-shot examples to each gatekeeper (widget + facebook_comments).
  - Add 1-2 examples to the facebook_comments main prompt.
  - Add explicit grounding instruction near the top of widget.main:
    "Reply only using the information provided in the knowledge base. Do not
    use your own knowledge. If the answer is not explicitly in the knowledge
    base, state that the information is not available."
  - Move the "Good Conversation Examples" section in widget.main to after
    Insurance Guidelines (after rules, before capabilities).
  - Remove insurance data duplication from widget.main — keep behavioral rules
    in SP, leave dollar amounts / insurer names / coverage in KB. Single
    source of truth.
  - Add a closing anchor in `services/prompt_composer/src/server.js` after the
    KB block: "Based on the knowledge base above, respond to the user's
    latest message."
  - **[Low priority / future]** Reorder prompt-composer so KB comes before
    examples (Gemini guideline). Bigger refactor — splits `main` into two
    parts. Not urgent.

- [claude] [defer] **Migrate system_prompts from `.js` module to plain `.txt`
  files.** Final step of the JSON → JS → TXT progression: one file per prompt
  key (`data/prompts/widget.gatekeeper.txt`, etc.). LLM reads/writes file
  directly, zero syntax. Loader becomes a ~5-line directory scan. POST writes
  per-key files. Not urgent — `.js` is already a big improvement.
  (added 2026-03-17)

### Cross-client routing & capabilities

- [claude] [P4] **Harden cross-client `REDIRECT_TO_DOCTOR` against LLM slug
  mangling.** When eintal redirected to Yomi Alpurer, the LLM produced
  `yumialpurrer` / `alpurrer` etc. instead of the configured slug. Root cause:
  LLM re-transliterates Hebrew names phonetically when switching from Hebrew
  body to ASCII action block. Fix applied 2026-04-19: renamed slug to
  `yomialpurrer` to match natural transliteration. Real fix for the future:
  - **Cheap safety net (~15 lines):** Levenshtein-match LLM output against a
    hardcoded list of valid sibling slugs inside the capability.
  - **Real fix:** opaque IDs in KB tags (`[QABU:#1]`), per-client
    `cross_refs.json` mapping `#1 → yomialpurrer`, served via the generic crud
    loop. Capability resolves at runtime. LLM only copies a 2-char token.
  - **Triggers:** self-onboarding live + arbitrary slugs; >5 clients
    cross-referencing each other; a second slug-arg capability;
    LLM-generated wrong redirect reaches a real user.
  - Also flag: `https://${slug}.qabu.net` is duplicated in every client's
    `capabilities.js` — shared capability library would fix that too.
  (added 2026-04-19)

- [roy] [P3] **Add capability — REDIRECT (open url in a new tab).** Generic
  capability for opening external URLs.

### Rate limits & per-client config

- [roy] [P3] **Per-client rate limits and token budgets in prompt-composer.**
  Currently hardcoded (5 req/20s) for all clients. For tiered pricing:
  - Add `limits` to `client-config.json` or a `limits.json` in `data/`:
    `requests_per_minute`, `requests_per_day`, `max_input_length`,
    `max_output_tokens`, `monthly_token_budget`.
  - Read at startup (same `import`-into-`$` pattern). Track cumulative usage
    from API token counts; persist to `data/usage.json` (daily/monthly).
  - Enforce: reject or canned response when limits exceeded; set `max_tokens`
    on the API call by tier.
  - Shared API keys, internal tracking — no per-client keys.
  - Add tier/plan to onboarding form so limits are set on creation.
  - Affects all channels (widget, FB comments, FB DMs).

### Commerce / billing

- [roy] [P3] **Stripe billing integration.** Gate new clients behind a paid
  subscription per `QABU-PLAN.md` Phase 3 / `QABU-VISION.md` §8. Tiers (target,
  not finalized): Starter ~$20/mo, Professional ~$100/mo, Premium ~$300/mo.
  Implementation:
  - Stripe Checkout in the onboarding flow before scaffolding — no subdomain
    is provisioned without an active subscription.
  - Subscription record per client (in `client-config.json` or Stripe-side
    metadata): `tier`, `stripe_customer_id`, `stripe_subscription_id`,
    `status`, `current_period_end`.
  - Webhook handler for subscription lifecycle events
    (`invoice.payment_failed`, `customer.subscription.deleted`,
    `customer.subscription.updated`). Decide grace period (~7 days?) before
    suspending the client stack.
  - Tier feeds into the per-client rate limits task (Starter = lighter models
    + lower limits; Premium = highest limits) — those two tasks land together.
  - Convert eintal to paying as the validation customer (per the Phase 2 gate
    in `QABU-PLAN.md`).
  - Decide what "suspended" means operationally: stop the compose stack via
    conductor? Show a "subscription expired" landing page? Keep data so
    reactivation is one click. **Do not delete client data on lapse** —
    backups exist for accidents, not for policy enforcement.
  - Open question: does Stripe handle ILS billing cleanly for Israeli
    customers, or does payment go through a separate processor for IL? Check
    before committing end-to-end. (added 2026-04-26)

### Onboarding, infra, deploy

- [claude] [defer] **Onboarding invite codes: audit trail + expiry.** The
  invite gate (added 2026-07-05 when the onboarding page went public) reads
  single-use 9-char codes from a bind-mounted, gitignored
  `data/invite_codes.txt` and deletes each code after a successful creation —
  good enough for manual testing/demoing. What's deliberately missing: no
  record of *who* used a code / when / for which subdomain (only the deletion
  in the file, and the created client itself), and unused codes never expire.
  If invites go to real prospects at scale, log consumption (code, x-auth-email,
  subdomain, timestamp — e.g. append to a `data/invite_log.jsonl`) and consider
  per-code expiry dates. Not worth building while codes are handed out one at
  a time by Roy/Nevo. (added 2026-07-05)

- [claude] [P1] **Onboarding must create the client's DNS record (Cloudflare
  API) — new clients are unreachable after the wildcard switchover without
  it.** While discussing how to tell if a subdomain is taken (2026-07-05), we
  realized the wildcard-DNS switchover (task below) breaks onboarding: today a
  scaffolded client is instantly live because `*.qabu.net` routes everything
  to the client VM, but once the wildcard points at the *main* VM, a new
  client's subdomain keeps resolving there (claim page) until an exact A
  record → its client VM is added. Fix: after a successful scaffold, onboarding
  (`services/client_onboarding/src/server.js`) creates the A record via the
  Cloudflare API, pointing at the VM it scaffolded on; on `err 409`/failure,
  no record. Check the existing `cloudflare_api_token` scopes — the cert
  tokens need only DNS-edit, which happens to be the same permission, but
  verify zone coverage (qabu.net; qabu.co.il records stay manual/optional).
  Related: post-switchover, the Cloudflare zone is the only *global* registry
  of taken subdomains across VMs (each conductor only knows its own dirs);
  the `/taken` HTTP probe in onboarding keeps working unchanged. Must land
  before or together with the DNS switchover. (added 2026-07-05)

- [roy] [P2] **Deploy the "claim this subdomain" pitch page + wildcard-DNS
  switchover to the main VM.** While planning multi-VM client hosting (new ARM
  VMs), we decided `*.qabu.net → client VM` was a mistake: the wildcard should
  point at the *main* VM, with per-client exact DNS records (like `.co.il`
  already has) routing each client to its own VM. Unmatched subdomains then
  hit main and get a sales pitch ("my-cool-business.qabu.net is available —
  claim it"), not a 404. The code is done (2026-07-04): pitch page at
  `services/main_router/srv/claim/index.html` (one static file, EN/HE
  auto-switch on hostname, CTA → `qabu.net/onboarding?subdomain=<sub>` which
  now prefills), wildcard blocks in `services/main_router/src/Caddyfile` +
  `qa/main-router-Caddyfile`. To go live: (1) commit, `services/build.sh
  main_router` + `services/build.sh client_onboarding`; (2) copy `srv/claim/`
  to main VM `~/app/srv/` (it's a bind mount, not baked into the image);
  (3) deploy both services on main; (4) in Cloudflare, add exact A records
  for every live client (`drlipokatz`, `eintal`, `eintal-hadassah`,
  `yomialpurrer`, `dradamblack`, `aram-ent` → 129.159.159.251), verify each
  resolves, *then* repoint `*.qabu.net` → 129.159.134.3 and add
  `*.qabu.co.il` → 129.159.134.3; (5) run `check_main.sh` + `check_clients.sh`
  and curl a nonsense subdomain on both TLDs. Order matters: repointing the
  wildcard before the exact records exist takes every client down.
  (added 2026-07-04)

- [roy] [P1] **Nevo review: aram-ent KB + prompts (rewritten 2026-07-03 by
  Claude from aram-ent.co.il).** The KB (11 entries), system prompts (widget +
  facebook), greeting and og-meta were rebuilt from the real site — clinic
  info, 2 branches, doctors list, URG.ENT urgent-care center (hours, *6343,
  published prices), HMO/insurance arrangements (מכבי/מאוחדת/לאומית per their
  FAQ), surgery flow. Nevo should verify medical wording, the doctor list, the
  emergency-routing guidance (life-threatening → 101/ER vs urgent-ENT →
  URG.ENT), and whether quoting URG.ENT prices in chat is desirable. Deployed
  to the VM and live. (added 2026-07-03)

- [roy] [P1] **Oracle client VM is over conductor capacity — onboarding to it
  now always fails.** `conductor/src/main.cpp` has `MAX_TIER = 5` and refuses
  `create_client` when `dir_count() + tier > MAX_TIER`. With aram-ent the VM
  has 6 client dirs, so any future onboarding create on this VM returns
  `err 507` (this is likely also why aram-ent had to be added by hand,
  2026-07-03). Decide: raise the cap, make it configurable (it's compiled in),
  or point onboarding at a new VM. Ties into the onboarding long-tail
  "capacity rules" item. (added 2026-07-03)

- [claude] [P1] **Conductor didn't react to a config.env change on the Oracle
  VM.** During the telegram-agent prod deploy (2026-07-03) we rewrote
  `clients/drlipokatz/private/config.env` (added the `telegram` profile) and
  the conductor — running, pid confirmed — never ran pull/up; we deployed
  manually. `main.cpp` adds an IN_CLOSE_WRITE|IN_MOVED_TO watch on `private/`
  and filters for the name `config.env`, so a bash `printf >` over ssh should
  have fired it. Matters because the admin "Manage Services" button relies on
  exactly this path to apply profile changes. Investigate: is the watch still
  alive after 5+ weeks of uptime (inotify wd leak / dir replaced by rsync or
  backup tooling?), where does conductor stdout go (nothing in journald —
  started outside systemd?), and reproduce with a `touch`/rewrite while
  strace-ing. Consider having conductor log to a file so failures are ever
  visible. **Second data point (2026-07-03, aram-ent):** aram-ent was created
  on the VM with `COMPOSE_PROFILES=site` in `private/config.env`, yet the
  `site` container was never created — https://aram-ent.qabu.net/ 502'd for
  ~2 days until we manually ran `docker compose --env-file private/config.env
  up -d`. Either the same dead-watch bug, or the stack was brought up manually
  without `--env-file` (a manual `docker compose up` silently drops all
  profiles — foot-gun worth documenting in CLAUDE.md's deploy section).
  Related weakness found reading `main.cpp`: `reconcile()` only calls
  `start_stack` when *zero* containers run (`stack_running` = "any container
  up"), so a partially-up stack (missing profile services) is never healed —
  even a working watch can't fix a stack that diverged while conductor was
  down. Consider making reconcile compare expected services
  (`compose config --services` with env-file) against running ones.
  (added 2026-07-03)

- [roy] [P1] **Enable the Telegram agent for a first client (drlipokatz).**
  The `services/telegram_agent/` service is built (2026-07-02 conversation:
  per-client Claude Code in a container, one Telegram group per client with
  Roy + Nevo + `<client>-claude`, read-only Phase 1 — full design in
  `docs/architecture.md` § Telegram Agent). Code, compose template, QA wiring
  and docs are done; what's left is the manual per-client enablement, which
  only Roy can do:
  1. BotFather: `/newbot` → `drlipokatz_qabu_bot` (prod) AND
     `drlipokatz_qa_qabu_bot` (QA — decided 2026-07-03: dedicated QA bot,
     never the prod token; one poller per token + QA mustn't touch prod
     integrations). `/setprivacy` → Disable on BOTH. Prod token goes only to
     the VM; QA token only to local `secrets/clients_secrets/`.
  2. Run `claude setup-token` (1-year subscription OAuth token — decided
     2026-07-03 to use Roy's Claude subscription, not an API key) → save as
     `secrets/clients_secrets/claude_credential.secret` locally (QA) and copy
     both secrets to `~/app/clients/drlipokatz/secrets/` on the Oracle VM
     (`telegram_bot_token.secret`, `claude_credential.secret`). The secret
     also accepts a console API key (`sk-ant-api...`) — auto-detected by
     prefix — if subscription limits ever pinch.
  3. `services/build.sh telegram_agent`, create the group (Roy + Nevo + bot),
     message it, read the ignored-user log line for the two user ids, put them
     in `data/telegram.json` on the VM, add `telegram` to `COMPOSE_PROFILES`
     in `private/config.env`.
  Why: this is the "Telegram owner channel" P1 item from QABU-PLAN (note: the
  plan said single shared bot; we deliberately switched to instance-per-client
  for a cleaner trust boundary — one container sees one client's data). Write
  support (KB edits from the phone) is Phase 2 and blocked on the diff-confirm
  flow + backups. (added 2026-07-02)

- [roy] [P3] **Two free ARM (Ampere A1) VMs provisioned on Oracle — not yet
  usable for Qabu.** While discussing Oracle's Always Free tier (2026-06-21) we
  confirmed the ARM Ampere allocation (4 OCPU / 24 GB) is a *separate* pool from
  the two AMD `E2.1.Micro` always-free instances. Roy grabbed Ampere capacity
  (the hard part — `Out of host capacity` is the usual blocker) and created two
  `VM.Standard.A1.Flex` VMs in AD-1, both Ubuntu 24.04.4 LTS (upgraded in
  place — supported to Apr 2029 — `aarch64`, running, free; OS verified via
  SSH 2026-07-05, and `brande` user + key auth already provisioned on both):
    - **arm1** — `129.159.154.37` (priv `10.0.0.102`), **3 OCPU / 18 GB**.
      Hostname `qabu-client-arm1`. Fully patched + rebooted onto current
      kernel 2026-07-07 (after clearing a first-boot `apt-daily` hang that
      held the apt lock for 6 days).
    - **arm2-small** — `129.159.141.23` (priv `10.0.0.190`), **1 OCPU / 6 GB**.
      **Not available for Qabu for now** — Roy repurposed it for personal
      (non-Qabu) use (2026-07-10). Plan around arm1 only; if Qabu ever needs
      the capacity back, that's a discussion with Roy, not a free resource.
  Together they consume the **entire** 4 OCPU / 24 GB ARM pool — no room for a
  3rd ARM free instance, and the monthly budget (3,000 OCPU-hrs / 18,000 GB-hrs)
  is ~99% used running both 24/7 (≈2,976 OCPU-hrs). **Near-zero margin**: any
  resize-up or a temporary 5th instance tips into billed usage. TODO: set a
  Billing → Budgets alert (~$1) as a tripwire.
  Notes / gotchas:
    1. ~~**Blocker: `linux/arm64` images.**~~ **Solved** — `services/build.sh`
       now builds multi-arch (`linux/amd64` + `linux/arm64`) via buildx and
       pushes a single manifest list per tag (see CLAUDE.md § Building images).
       No image blocker remains for deploying to these boxes.
    2. **Two firewall layers** before they serve traffic: OCI VCN Security
       List/NSG (open 80/443) **and** the host's default iptables (Oracle images
       block everything but SSH at the OS level too — classic "opened 443 in OCI
       but nothing connects" trap). `setup_server.sh` handles the host layer
       (ufw takes over, purges Oracle's stock iptables).
    3. **OCI console still shows Ubuntu 20.04** for both — cosmetic only. The
       image field is launch-time metadata and does NOT update on an in-place
       `do-release-upgrade`; the real OS (24.04.4 LTS, confirmed via
       `/etc/os-release` on 2026-07-05) is the source of truth. Ignore the
       console label.
    4. **Why in-place upgrade, not recreate:** pool is maxed so you can't
       create-before-terminate; terminating to recreate would gamble the Ampere
       capacity that's scarce. Upgrade-in-place keeps the instance + capacity.
  Opportunity: arm1 (3/18) is a capable box sitting free — a real upgrade over
  the cramped 1 OCPU / 1 GB Oracle micros, and a step toward the
  **VM-per-client** ideal that `CLAUDE.md` calls out (multi-tenant is "a cost
  concession, not the ideal"). Note the pool of *Qabu-usable* ARM capacity is
  now arm1 alone. With multi-arch images done and base provisioning
  (`setup_server.sh`) already run, what remains is role setup per
  `docs/client-server-setup.md` (registry login, conductor, clients-router,
  secrets) + DNS. (added 2026-06-21; refreshed 2026-07-10.)

- [claude] [P3] **Conductor treats a partial stack as healthy.** While bringing
  up yomialpurrer + dradamblack (2026-06-20), only the 4 core (no-profile)
  services started on the first conductor reconcile; the `site` + `facebook`
  profile services never came up until a manual `docker compose --env-file
  private/config.env up -d`. Root cause is `stack_running()` in
  `clients_server_automation/conductor/src/main.cpp` — it returns true if **any**
  container is running (`ps -q --status running | grep -q .`), so once the core
  services are up the conductor considers the stack healthy and never re-runs
  `start_stack`. A stack that starts partially (or where a profiled service later
  crashes and isn't restarted) is silently left degraded. The 60s reconcile loop
  won't repair it. Fix: make the health check compare running services against
  the set compose *expects* given the env-file profiles (e.g. diff `ps
  --services --status running` against `config --services`), and re-run
  `start_stack` when any expected service is missing. (added 2026-06-20, after
  the first bring-up of both demos came up core-only and needed a manual re-up.)

- [roy] [P1] **Auto-create DNS records via Cloudflare API on scaffold.** Today,
  someone manually adds an A record after onboarding. The conductor (or
  provisioner) should call the Cloudflare API after a successful scaffold.
  Token already on the client VM (Caddy uses it for TLS). Becomes essential
  with multiple client VMs since wildcard `*.qabu.net` only points to one IP.
  (added 2026-04-02)

- [roy] [P0] **Migrate clients VM from AMD E2.1.Micro to Oracle A1.Flex (ARM).**
  Triggered by 2026-04-23 OOM hang on the 1 GB AMD VM. Status 2026-07-05:
  the ARM capacity is secured — two A1.Flex VMs exist (arm1 3/18 +
  arm2-small 1/6, see the "Two free ARM VMs" task above; the quota went to
  two boxes instead of the originally recommended single 4/24) and
  `services/build.sh` already builds+pushes multi-arch images. Remaining:
  - Conductor (C++20) needs an ARM build — compile in `arm64v8/ubuntu` or
    natively on the ARM box.
  - Role setup on the target VM per `docs/client-server-setup.md` (registry
    login, conductor, clients-router, secrets).
  - Migrate clients one at a time: rsync data, update Cloudflare DNS, compose
    up on new, verify with `check_clients.sh`, compose down on old. All
    clients land on **arm1** (arm2-small went to Roy's personal use
    2026-07-10, see the "Two free ARM VMs" task above; still ties into the
    wildcard-DNS switchover task — per-client exact DNS records).
  - Update `docs/client-server-setup.md` + fleet scripts (`check_clients.sh`,
    `rsync_clients.sh`, `check_versions.sh`) afterwards. (added 2026-04-25;
    refreshed 2026-07-05)

- [roy] [defer] **Migrate secrets to Infisical.** Currently rsynced to VMs
  manually. Pull at runtime instead — no rsync, no machine dependency.
  (added 2026-03-28)

- [roy] [P0] **Rebuild and redeploy conductor binary.** Three pending source
  fixes: (1) `setbuf(stdout, NULL)` so logs show in journalctl, (2) remove
  `2>/dev/null` from `start_stack` and `stack_running` so docker compose
  errors are visible, (3) `RuntimeDirectory=qabu` in systemd unit (already on
  server, binary needs rebuild). Build: `docker run --rm -v
  $(pwd)/clients_server_automation/conductor/src:/src -w /src gcc:latest g++
  -std=c++20 -O2 -static -s -o /src/conductor main.cpp`, then scp + restart.
  **Extra urgency surfaced 2026-05-17:** the binary live on the Oracle client
  VM is from 2026-04-05 — it predates the `--env-file private/config.env`
  fix in `start_stack` (committed 2026-04-25, `b384255`). Without that fix
  `COMPOSE_PROFILES` never activates, so on every reboot only the
  no-profile services come up (admin, widget, prompt-composer, services-router)
  and site + facebook stay down silently. We hit exactly this when the
  Oracle VM rebooted overnight 2026-05-16 → eintal and drlipokatz both
  went down until manual restore. `stack_running()` returns true as soon
  as *any* container is up, so conductor never retries. Also redeploy the
  shared-infra stack at `~/app/docker-compose.yml` somehow (systemd unit or
  add to conductor's scope) — clients-router/auth-verifier/provisioner also
  didn't come back automatically after the reboot. (added 2026-04-06)

### Admin & widget UX

- [both] [P0] **Make the admin work perfectly for Nevo.** Top-top priority for
  Phase 0 alongside FB reliability. Currently the admin has friction that
  prevents Nevo from confidently editing eintal's KB/SP/greeting on the fly.
  **This task needs to be made concrete before work starts** — Roy will get
  Nevo to enumerate the specific 3-5 things that don't work. Likely
  candidates to probe: Hebrew/RTL polish, KB-editor reliability, SP-editor
  draft state, publish-error visibility, real-time propagation of edits to FB
  replies (no restart needed), auth stability. Acceptance: Nevo updates a KB
  entry at 2pm and Qabu uses the new answer on the next FB comment without
  Roy in the loop. (added 2026-04-27)
- [roy] [defer] **Admin: comment as multiple users in Facebook test.** Add a
  few avatar images to the docker images so the admin can simulate different
  commenters.
- [roy] [P3] **Admin: "build the prompt without sending it"** — extend the
  See Prompt button so it asks prompt-composer to compose what *would* be sent
  given current draft state, without firing the LLM call. Today's
  `last_prompt.json` only shows what was actually sent.
- [roy] [P3] **Test the widget as an embedded widget.** Build a demo external
  site, drop the widget in via `<script src="https://<sub>.qabu.net/widget.js">`,
  test the full flow.
- [roy] [P3] **Add CORS support on the client services-router for cross-origin
  widget embedding.** While building the QA embed demo (`qa/embed-demo/`) we
  found that true external embedding (host page on `acme.com`, widget loaded
  from `drlipokatz.qabu.net`) currently breaks: `fetch('/prompt-composer/ask')`,
  `fetch('/prompt-composer/greeting')`, and the `import('/prompt-composer/capabilities')`
  dynamic import all hit CORS errors because the services-router doesn't emit
  `Access-Control-Allow-Origin` headers. The QA demo works around this by
  proxying all widget paths through its own Caddy so everything is same-origin
  — useful for demoing the UI, but not the prod scenario. Need to decide on
  the allowed-origins policy (open `*` for the public widget endpoints? per-client
  allowlist? Roy + Nevo to discuss) and add `header` directives in
  `services/services_router/src/Caddyfile` for `/widget.js`, `/widget.css`, and
  `/prompt-composer/*`. Also verify `import()` works — module CORS is stricter
  than `fetch` (needs `crossorigin` attribute on the script tag or the response
  needs proper CORS). (added 2026-05-25)
- [roy] [defer] **Save cleared chat for reference.** When the user clears a
  chat, keep the previous conversation accessible (history view, not gone
  forever).

### Facebook

- [both] [P0] **Confirm eintal's FB pages are registered as testers on our
  unpublished FB app.** Without tester status, our app can't post replies on
  their pages — this blocks the entire Phase 0 launch. Tester invites are
  quick (Facebook allows up to 50 testers); anything beyond that becomes a
  hidden-week risk. Roy + Nevo to verify together this week.
  (added 2026-04-27)
- [roy] [P0] **Test facebook_comments and facebook_dm in production.**
  End-to-end with real Facebook events.
- [both] [P2] **facebook_comments → DM per gatekeeper decision** (Nevo's idea).
  Gatekeeper decides whether to reply on the comment thread or move to DM.
- [roy] [P3] **Create Facebook page for Dr Adam Black.** For the EN demo.
- [roy] [defer] **Multi-page per client support.** One client → multiple
  Facebook pages.

### Auth & security

- [roy] [P2] **Deploy the `/bab/*` authenticated sub-route (code done + QA
  verified 2026-07-12, needs commit + prod rollout).** The generic authed
  prefix (Akkadian *bābu* = "gate") decided in the 2026-07-11 dashboard
  conversation is fully implemented in the working tree: clients-router
  `forward_auth` moved from `/admin/*` to `/bab/*` (with `/admin*` 301
  back-compat, prod + QA Caddyfiles), services-router routes
  `/bab/{service}/*` → `{service}:4322` (two-port convention: 4321 public,
  4322 authed), admin listens on 4322 and lives at `/bab/admin/`
  (server.js, loader.js, admin.js via one `PREFIX` const), and the four
  outside references were updated (mock-facebook `/bab/admin/ask`,
  onboarding post-create redirect, telegram-agent prompt, `check_main.sh`
  canary). Docs updated (CLAUDE.md § Caddy Routing / § Admin & Shared UI,
  architecture.md routing tables + two-port convention, config compose
  template comment). Verified in QA with a minted JWT: `/admin/*` 301s,
  logged-out `/bab/admin/` → login redirect, authed editor endpoints +
  `/ask` with KB/SP overrides answer correctly, public site/widget/chat
  untouched on drlipokatz (HE) and dradamblack (EN), `/admin.js` and
  `/bab/nonexistent/` fail sanely. Remaining — Roy must:
  1. Commit (build.sh stamps the revision label from HEAD).
  2. `services/build.sh` for `admin`, `services_router`, `clients_router`,
     `mock_facebook`, `client_onboarding`, `telegram_agent`.
  3. Deploy: client VM shared infra + every client stack (pull + up);
     `client_onboarding` on main. **Interlock:** clients-router and admin
     must land together — old `/admin` path dies the moment admin stops
     listening on 4321 (~1-min admin outage; public chat unaffected).
  4. `check_main.sh` + `check_clients.sh`; manually open
     `https://drlipokatz.qabu.net/bab/admin/` and click through the six
     buttons (QA couldn't exercise the real Google OAuth hop or `.co.il`
     bounce).
  Future-service contract now in effect: listen on 4322, be named `<name>`,
  and you're live at `/bab/<name>/` behind Google auth — just copy admin's
  `authorized_emails` check (auth ≠ authorization). (added 2026-07-11,
  implemented 2026-07-12)

- [roy] [defer] **Zero-downtime key rotation for the admin↔prompt-composer
  shared secret.** Today the admin sends `x-admin-secret` and prompt-composer
  validates against a single value. Rotation requires both sides to swap
  simultaneously. Idea: support N valid keys at once during a rotation
  window, like the FB dispatcher pattern. Open question — sketch the design.

### Landing page

- [roy] [P3] **Verify the credit on the landing page.** Roy thinks it's wrong.
- [roy] [P4] **Subdomain-availability check on the landing page.** Live check
  whether `<sub>.qabu.net` is taken before the user signs up — better
  conversion. (Server already exposes `/taken`.)
- [roy] [P4] **404 page + "name taken but site not active" page.** UX for
  not-yet-deployed or partially-deployed subdomains.
- [roy] [P4] **Cloudflare-only origin firewall.** Only allow Cloudflare IP
  ranges at the origin VMs (security hardening).
### Skills

- [roy] [defer] **UI skill with brand colors.** Make the brand-colors palette
  available as a skill.
- [roy] [defer] **Customize prompt-engineer skill to be Qabu-specific** and
  figure out how to make sure it's invoked consistently.

### Architecture (open questions, not yet decided)

- [roy] [defer] **Move site routing from site Caddy to clients-router?** Per
  CLAUDE.md "VM Strategy" the rule is clients-router = cross-cutting only,
  services-router = per-client only. Worth checking which routes violate
  this and whether it's worth consolidating.
- [roy] [defer] **Should the widget be per-client (versioned) instead of
  shared?** Today widget is a shared service routed at `/widget.js`. Pin
  per-client versions instead — gives backwards-compat headroom but adds
  operational overhead.
- [roy] [defer] **Should the site be Node.js instead of Caddy-static?**
  Capability for dynamic content.
- [roy] [defer] **Try `knowledge_base.json` → `.js` with custom JSON.stringify**
  (same motivation as system_prompts migration).
- [roy] [defer] **Move to Podman?** Backlog question.

### Followups & review

- [both] [P0] **Build eintal's real KB from their existing site content.**
  Roy + Nevo joint content session. Not a code task — a content task.
  Eintal's doctors, services, opening hours, insurance, locations, etc. all
  go into a single KB just like the existing demo clients. No multi-doctor
  routing needed (eintal answers from one KB; drlipokatz / yomialpurrer stay
  as test fixtures only). Schedule the session early — weeks 3-5 of the
  Phase 0 plan stall if eintal can't sit down for content. (added 2026-04-27)
- [roy] [defer] **Go over Claude bot results** —
  https://claude.ai/code/session_015amX6XQKE6anSW2Vf9QjoU and
  https://claude.ai/code/session_013buYQPiU1E2Fyo9qYzqSCK
- [roy] [P1] **Process emails from Nevo** —
  [I](https://mail.google.com/mail/u/0/#inbox/WhctKLbvVXrBNMTCBwqFvcjcfzFdLtdQjlGfblZTDlbmrkprCsgZwRjkplvmrJVBQDZSBpQ),
  [II](https://mail.google.com/mail/u/0/#inbox/WhctKLbvVXbFBvGWJclwtWNzmkzlWHhppdMVgzplnpwMWHVnCrjkRXngmNBQNZrJVMplDkQ)
- [roy] [P1] **Set up `roy@qabu.net`** (or similar) — today only
  `privacy@qabu.net` exists via Cloudflare Email Routing.
- [roy] [defer] **Use git worktree** — try the workflow once a parallel branch
  comes up.
- [roy] [defer] **Clean up old tests** in the codebase.
- [roy] [defer] **Salvage anything useful from `rny3_docs` and delete the
  repo.** `rny3_docs` is a separate git project with early Qabu documents and
  design docs. Go through it, pull anything still worth keeping into this repo
  (likely under `docs/`), then delete the repo.
- [roy] [P4] **Build Qabu for Qabu.** Sub-tasks:
  - [x] Logo
  - [ ] Video demo
  - [x] Buy `qabu.co.il` (in addition to `.net`)
  - [ ] Qabu JS interface: movie clip, phone-number form, payment form
  - [ ] Links to demos
- [roy] [defer] **Create `Qabu` for Vered, Irena, and a third demo** to
  broaden the demo set beyond the current 5. (Verify still wanted — depends
  on how eintal conversion goes.)
- [roy] [P4] **API for Qabu to control its own site** (see QABU-VISION for
  detail).

## When X happens

Conditional tasks that fire on a specific event.

- [roy] [when-X] **When switching to Anthropic as LLM provider** — update
  Privacy → Third-Party Processors to add Anthropic, Inc. alongside Google
  and Groq. One extra `<li>` with link to their privacy policy. Path: privacy
  is now served from `/srv` static files on the main server (see CLAUDE.md
  "Main router"). (added 2026-03-15)
- [roy] [when-X] **When incorporating** — replace "independent service operated
  by its founders, based in Israel" in Privacy and Terms with the registered
  company name. Have a lawyer review both documents. (added 2026-03-15)

## Personal

- [roy] [defer] Organize my desk.

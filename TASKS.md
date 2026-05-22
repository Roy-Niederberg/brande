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

### Source of Truth & client-data lifecycle

- [roy] [P0] **MVP backup doesn't survive VM reboot — add a reboot-survival
  shim.** The backup MVP runs as `tmux new -d -s backup ~/app/backup_loop.sh`
  in a user-owned tmux session on the eintal client VM. If the VM reboots
  (planned maintenance, kernel patch, crash), tmux dies and the watcher is
  silently gone until someone notices a stale `git log` — at which point
  there's no backup for that window. The proper fix is the
  `services/backup/` Dockerized service (tracked separately below) which
  restarts via Docker's restart policy. Until that ships, do one of:
  - `crontab -e` → `@reboot tmux new -d -s backup ~/app/backup_loop.sh`
    (simplest, no systemd unit needed; uses Roy's existing user crontab)
  - or a tiny systemd *user* unit at `~/.config/systemd/user/qabu-backup.service`
    with `Restart=always` and `loginctl enable-linger brande`.

  **Why:** silent backup death is worse than no backup — you think you're
  protected and you're not. Window of risk = uptime between reboots, which
  on Oracle VMs can be weeks of complacency followed by an unexpected
  reboot. (added 2026-05-21, while verifying the MVP works end-to-end —
  watcher loop confirmed to commit/push on create/modify/delete of
  whitelisted files, but reboot-survival was the one gap not addressed.)

- [both] [P0] **Replace the MVP backup with a proper `services/backup/` Node
  service.** An MVP is live on the eintal client VM as of 2026-05-19: a tmux
  session running `find data private -type f | entr -d ...` inside
  `~/app/clients/eintal/`, which rsyncs into a cloned GitLab repo
  (`rny3/qabu_clients`) and commits + pushes on every change. SSH deploy key
  at `~/.ssh/qabu_backup`, write-enabled in GitLab. It works but:
  (a) only covers eintal — not drlipokatz, yomialpurrer, or the GCP VM's
  ofirfichman; (b) needs `entr` and `git` installed on the host, violating
  the everything-in-Docker rule; (c) tmux doesn't survive VM reboot — needs
  manual reattach; (d) no debounce — a burst of admin saves yields multiple
  commits.

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
  (`dradamblack`, `drlipokatz`, `eintal`, `yomialpurrer`, `ofirfichman`).
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

- [roy] [P1] **Auto-create DNS records via Cloudflare API on scaffold.** Today,
  someone manually adds an A record after onboarding. The conductor (or
  provisioner) should call the Cloudflare API after a successful scaffold.
  Token already on the client VM (Caddy uses it for TLS). Becomes essential
  with multiple client VMs since wildcard `*.qabu.net` only points to one IP.
  (added 2026-04-02)

- [roy] [P0] **Migrate clients VM from AMD E2.1.Micro to Oracle A1.Flex (ARM)
  + multi-arch Docker images.** Triggered by 2026-04-23 OOM hang on the 1 GB
  AMD VM. ARM Always Free quota: 4 OCPU + 24 GB RAM (separate quota from AMD,
  permanent). Recommended target: one 4-OCPU/24-GB A1.Flex.
  - Verify Always Free billing mode, 200 GB storage cap math, A1 availability
    in `il-jerusalem-1` (biggest unknown — Oracle reclaims idle A1 after 7
    days, so don't leave new VM empty).
  - Switch `services/build.sh` to `docker buildx --platform
    linux/amd64,linux/arm64`. Most images use Alpine which already has ARM.
  - Conductor (C++20) needs ARM build — compile in `arm64v8/ubuntu` or
    natively on the new VM.
  - Migrate clients one at a time: rsync data, update Cloudflare DNS, compose
    up on new, verify with `check_clients.sh`, compose down on old.
  - Future option: split ARM quota into multiple smaller VMs for redundancy
    (revisit per CLAUDE.md "VM Strategy").
  - Update `docs/client-server-setup.md` afterwards. (added 2026-04-25)

- [roy] [defer] **Migrate secrets to Infisical.** Currently rsynced to VMs
  manually. Pull at runtime instead — no rsync, no machine dependency.
  (added 2026-03-28)

- [roy] [P0] **GCP VM (ofirfichman) wildcard cert will fail to renew on
  2026-07-19 — ~2 months out.** While debugging why ofirfichman was down on
  2026-05-17 (turned out to be a frozen VM, fixed by console restart + manual
  `docker compose up -d` in `~/app/clients/ofirfichman/`), I discovered
  `app-clients-router-1` is logging continuous ACME renewal failures:
  `context deadline exceeded` reaching `acme-v02.api.letsencrypt.org`.
  Root cause: Roy removed Cloud NAT from the GCP project to stop being
  billed for the static IPv4. The VM is IPv6-only, and Let's Encrypt's
  ACME endpoints are IPv4-only — so Caddy can no longer fetch/renew the
  wildcard cert. The cached `*.qabu.net` cert in the `router_data` volume is
  valid until **2026-07-19 19:34 UTC**. After that, every HTTPS request to
  `ofirfichman.qabu.net` will fail TLS and Cloudflare will start serving
  errors. Three options to pick from (discussed but not chosen): (a) renew
  on the main server (which has IPv4) and rsync the cert into the GCP
  `router_data` volume on a schedule, (b) switch to a Cloudflare Origin
  Certificate — issued by CF, doesn't need public ACME at all, just
  install once and good for 15 years, (c) re-enable Cloud NAT around
  renewal time only. Option (b) is the cleanest if we want to keep this VM
  free-tier long-term. Note: ofirfichman is a demo (Roy's architect
  friend) so downtime here isn't customer-facing, but the same problem
  will hit any future GCP IPv6-only VM. Also, this VM has **no conductor
  at all** (no `~/app/conductor` binary, no `qabu-conductor.service`) — so
  every reboot requires manually bringing the client stack up. Worth
  installing conductor here once the binary is rebuilt (see the P0
  conductor task above). (added 2026-05-17)

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
- [roy] [P3] **Restore widget minimize / reopen.** An earlier version (commit
  `ea62340`, when widget lived at `services/router/public/widget.js`) had
  minimize/maximize with a floating reopen bubble — essential for embedding
  on existing pages. Lost in the big rewrite (`6cdf7d5`).
- [roy] [P3] **Test the widget as an embedded widget.** Build a demo external
  site, drop the widget in via `<script src="https://<sub>.qabu.net/widget.js">`,
  test the full flow.
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
  - [ ] Buy `qabu.co.il` (in addition to `.net`)
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

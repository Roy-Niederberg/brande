# Tasks

Open tasks for Qabu. Ownership tags: `[roy]`, `[claude]`, `[both]`. New tasks
should follow CLAUDE.md's "Task Management" rules: rich context, why it matters,
date in parens at the end.

## North Star

High-level direction, not directly actionable. Most concrete work below is in
service of one of these.

- [both] **Backup client data** — VM is the source of truth (see CLAUDE.md
  "Source of Truth"); without backups a single bad admin edit is unrecoverable.
  Highest-priority infra gap.
- [both] **Better chat logging** — production-grade conversation logs (per
  client, queryable, retained) for debugging, prompt iteration, and eventually
  customer-facing transcripts.
- [roy] **Give Nevo the MVP** — the sign-off milestone for "v1 done."
- [roy] **Finish self-onboarding** — `qabu.net/onboarding` exists and works for
  the happy path; the long tail (DNS automation, error UX, capacity rules,
  Cloudflare records) is what's left.
- [roy] **Qabu as an employee with personality** — the product vision: not just
  a Q&A bot, an agent that initiates, follows up, has identity.
- [roy] **Network of agents** — beyond gatekeeper + main, design the multi-agent
  topology (router, specialist, escalation, etc.).
- [both] **Local integration test environment** — Docker network with service
  containers + wiremock + browser container (noVNC, since host is Wayland).
  Keeps coming up; invest once enough end-to-end flows justify it.
  (added 2026-03-28)

## Open

### Source of Truth & client-data lifecycle

- [both] **Set up client-data backup before the first paying client.** Cron +
  tar + Cloudflare R2 or Backblaze B2 (~15 lines) over `~/app/clients/*/data`
  and `~/app/clients/*/private` on each client VM. Don't ship to a paying
  customer without this. (Highest priority. Tied to CLAUDE.md "Source of Truth"
  gap #1.) (added 2026-04-19)
- [roy] **Decide what happens to demo clients currently in git**
  (`dradamblack`, `drlipokatz`, `eintal`, `yomialpurrer`, `ofirfichman`).
  Either keep them as seed fixtures under `services/config/files/` or `seeds/`,
  or remove them from git entirely and re-seed in QA from the template. Tied
  to CLAUDE.md "Source of Truth" gap #4. (added 2026-04-19)
- [roy] **Install Claude Code in Docker on the client VM** with a narrow mount
  scope (only `~/app/clients/<sub>/data` + `private/`) and a container-local
  CLAUDE.md restricting it to KB/SP edits. Stepping stone toward LLM-assisted
  editing for owners. (added 2026-04-19)
- [roy] **Add admin UI for the gaps** that currently force git+rsync edits:
  background images, `og-meta.html`, capability selection,
  `client-config.json` fields, `config.env` toggles beyond `COMPOSE_PROFILES`.
  Each gap is a reason someone bypasses the admin and touches git. Tied to
  CLAUDE.md "Source of Truth" gap #5.

### Prompt engineering

- [claude] **Fix trailing SLEEP action in LLM responses.** The LLM sometimes
  appends a standalone `|| SLEEP 2500` as the last action with nothing after it.
  Capabilities instructions teach the SLEEP→CONTACT_FORM pattern; the model
  over-applies SLEEP as a generic "let user read" signal. Harmless but wasteful
  (2.5s pointless pause). Clarify in the capabilities section that SLEEP is
  only valid before another action. Suggested wording:
  "השתמש ב-SLEEP רק לפני פעולה נוספת (כמו CONTACT_FORM) כדי לתת למשתמש זמן
  לקרוא. אל תשתמש ב-SLEEP כפעולה אחרונה — אין בכך תועלת."
  Use the `qabu-prompt-engineer` skill.

- [claude] **Optimize system prompts for Gemini (dradamblack + drlipokatz).**
  Apply to both clients. Use `qabu-prompt-engineer-gemini` skill.
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

- [claude] **Migrate system_prompts from `.js` module to plain `.txt` files.**
  Final step of the JSON → JS → TXT progression: one file per prompt key
  (`data/prompts/widget.gatekeeper.txt`, etc.). LLM reads/writes file directly,
  zero syntax. Loader becomes a ~5-line directory scan. POST writes per-key
  files. Not urgent — `.js` is already a big improvement. (added 2026-03-17)

### Cross-client routing & capabilities

- [claude] **Harden cross-client `REDIRECT_TO_DOCTOR` against LLM slug
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

- [roy] **Add capability — REDIRECT (open url in a new tab).** Generic
  capability for opening external URLs.

### Rate limits & per-client config

- [roy] **Per-client rate limits and token budgets in prompt-composer.**
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

### Onboarding, infra, deploy

- [roy] **Auto-create DNS records via Cloudflare API on scaffold.** Today,
  someone manually adds an A record after onboarding. The conductor (or
  provisioner) should call the Cloudflare API after a successful scaffold.
  Token already on the client VM (Caddy uses it for TLS). Becomes essential
  with multiple client VMs since wildcard `*.qabu.net` only points to one IP.
  (added 2026-04-02)

- [roy] **Migrate clients VM from AMD E2.1.Micro to Oracle A1.Flex (ARM) +
  multi-arch Docker images.** Triggered by 2026-04-23 OOM hang on the 1 GB
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

- [roy] **Migrate secrets to Infisical.** Currently rsynced to VMs manually.
  Pull at runtime instead — no rsync, no machine dependency. (added 2026-03-28)

- [roy] **Rebuild and redeploy conductor binary.** Three pending source fixes:
  (1) `setbuf(stdout, NULL)` so logs show in journalctl, (2) remove
  `2>/dev/null` from `start_stack` and `stack_running` so docker compose
  errors are visible, (3) `RuntimeDirectory=qabu` in systemd unit (already on
  server, binary needs rebuild). Build: `docker run --rm -v
  $(pwd)/clients_server_automation/conductor/src:/src -w /src gcc:latest g++
  -std=c++20 -O2 -static -s -o /src/conductor main.cpp`, then scp + restart.
  (added 2026-04-06)

### Admin & widget UX

- [roy] **Admin: comment as multiple users in Facebook test.** Add a few avatar
  images to the docker images so the admin can simulate different commenters.
- [roy] **Admin: "build the prompt without sending it"** — extend the See
  Prompt button so it asks prompt-composer to compose what *would* be sent
  given current draft state, without firing the LLM call. Today's
  `last_prompt.json` only shows what was actually sent.
- [roy] **Restore widget minimize / reopen.** An earlier version (commit
  `ea62340`) had minimize/maximize with a floating reopen bubble — essential
  for embedding on existing pages. Lost in the big rewrite (`6cdf7d5`).
  Document tracked in CLAUDE.md "Widget Service / Known Issues."
- [roy] **Test the widget as an embedded widget.** Build a demo external site,
  drop the widget in via `<script src="https://<sub>.qabu.net/widget.js">`,
  test the full flow.
- [roy] **Save cleared chat for reference.** When the user clears a chat, keep
  the previous conversation accessible (history view, not gone forever).

### Facebook

- [roy] **Test facebook_comments and facebook_dm in production.** End-to-end
  with real Facebook events.
- [both] **facebook_comments → DM per gatekeeper decision** (Nevo's idea).
  Gatekeeper decides whether to reply on the comment thread or move to DM.
- [roy] **Create Facebook page for Dr Adam Black.** For the EN demo.
- [roy] **Multi-page per client support.** One client → multiple Facebook
  pages.

### Auth & security

- [roy] **Zero-downtime key rotation for the admin↔prompt-composer shared
  secret.** Today the admin sends `x-admin-secret` and prompt-composer
  validates against a single value. Rotation requires both sides to swap
  simultaneously. Idea: support N valid keys at once during a rotation
  window, like the FB dispatcher pattern. Open question — sketch the design.

### Landing page

- [roy] **Verify the credit on the landing page.** Roy thinks it's wrong.
- [roy] **Subdomain-availability check on the landing page.** Live check
  whether `<sub>.qabu.net` is taken before the user signs up — better
  conversion. (Server already exposes `/taken`.)
- [roy] **404 page + "name taken but site not active" page.** UX for
  not-yet-deployed or partially-deployed subdomains.
- [roy] **Cloudflare-only origin firewall.** Only allow Cloudflare IP ranges
  at the origin VMs (security hardening).

### Skills

- [roy] **UI skill with brand colors.** Make the brand-colors palette
  available as a skill.
- [roy] **Customize prompt-engineer skill to be Qabu-specific** and figure
  out how to make sure it's invoked consistently.

### Architecture (open questions, not yet decided)

- [roy] **Move site routing from site Caddy to clients-router?** Per CLAUDE.md
  "VM Strategy" the rule is clients-router = cross-cutting only,
  services-router = per-client only. Worth checking which routes violate
  this and whether it's worth consolidating.
- [roy] **Should the widget be per-client (versioned) instead of shared?**
  Today widget is a shared service routed at `/widget.js`. Pin per-client
  versions instead — gives backwards-compat headroom but adds operational
  overhead.
- [roy] **Should the site be Node.js instead of Caddy-static?** Capability
  for dynamic content.
- [roy] **Try `knowledge_base.json` → `.js` with custom JSON.stringify** (same
  motivation as system_prompts migration).
- [roy] **Move to Podman?** Backlog question.

### Followups & review

- [roy] **Review QABU-VISION.md** — make sure it still reflects current
  thinking; pull anything still relevant into CLAUDE.md or here.
- [roy] **Go over Claude bot results** —
  https://claude.ai/code/session_015amX6XQKE6anSW2Vf9QjoU and
  https://claude.ai/code/session_013buYQPiU1E2Fyo9qYzqSCK
- [roy] **Process emails from Nevo** —
  [I](https://mail.google.com/mail/u/0/#inbox/WhctKLbvVXrBNMTCBwqFvcjcfzFdLtdQjlGfblZTDlbmrkprCsgZwRjkplvmrJVBQDZSBpQ),
  [II](https://mail.google.com/mail/u/0/#inbox/WhctKLbvVXbFBvGWJclwtWNzmkzlWHhppdMVgzplnpwMWHVnCrjkRXngmNBQNZrJVMplDkQ)
- [roy] **Set up `roy@qabu.net`** (or similar) — today only `privacy@qabu.net`
  exists via Cloudflare Email Routing.
- [roy] **Use git worktree** — try the workflow once a parallel branch comes
  up.
- [roy] **Clean up old tests** in the codebase.
- [roy] **Salvage anything useful from `rny3_docs` and delete the repo.**
  `rny3_docs` is a separate git project with early Qabu documents and design
  docs. Go through it, pull anything still worth keeping into this repo
  (likely under `docs/`), then delete the repo.
- [roy] **Build Qabu for Qabu.** Sub-tasks:
  - [x] Logo
  - [ ] Video demo
  - [ ] Buy `qabu.co.il` (in addition to `.net`)
  - [ ] Qabu JS interface: movie clip, phone-number form, payment form
  - [ ] Links to demos
- [roy] **Create `Qabu` for Vered, Irena, and a third demo** to broaden the
  demo set beyond the current 5. (Verify still wanted — depends on how eintal
  conversion goes.)
- [roy] **API for Qabu to control its own site** (see QABU-VISION for
  detail).

## When X happens

Conditional tasks that fire on a specific event.

- [roy] **When switching to Anthropic as LLM provider** — update Privacy →
  Third-Party Processors to add Anthropic, Inc. alongside Google and Groq.
  One extra `<li>` with link to their privacy policy. Path: privacy is now
  served from `/srv` static files on the main server (see CLAUDE.md "Main
  router"). (added 2026-03-15)
- [roy] **When incorporating** — replace "independent service operated by its
  founders, based in Israel" in Privacy and Terms with the registered company
  name. Have a lawyer review both documents. (added 2026-03-15)

## Personal

- [roy] Organize my desk.

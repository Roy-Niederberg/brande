# Roy's Tasks

The big plan:
-----
- [ ] Claude on the servers
- [ ] backup the client data on the server (and to the cloud somehow)
- [ ] Better log the chats.
- [ ] Give Nevo the MVP
- [ ] Finish the client-onboarding
- [ ] Work on testing
- [ ] Qabu as an employee with personality.

- [ ] Build a local integration test environment — Docker network with service containers + wiremock (to stub external calls like VM endpoints) + browser container for visual testing. Host uses Wayland so X11 forwarding won't work — use a VNC-based approach instead (e.g. `selenium/standalone-chrome` with noVNC, access via `localhost:7900` in host browser). Keeps coming up: hard to test end-to-end flows (like onboarding success → redirect) locally without real infrastructure. Invest in this once there are enough flows to justify it. (added 2026-03-28)

- [ ] **Update provisioner to use conductor socket** — now that conductor handles client creation (filesystem + docker), the provisioner (`services/provisioner/src/server.js`) needs to be rewritten to: validate the secret + subdomain, then forward to conductor via Unix socket at `/run/qabu/conductor.sock` (mount it in the provisioner container). The provisioner keeps HTTP, auth, and validation; conductor does everything else. (added 2026-03-30)

- [ ] **Write a "New Server Setup" guide** — document the full steps to provision a new Oracle Cloud VM for Qabu: install Docker, build + install the conductor binary, install `qabu-conductor.service`, set up Caddy TLS, etc. Replace references to `deploy.sh` and `prod_setup/`. Lives in `docs/` or a `SETUP.md`. (added 2026-03-30)

- [ ] **Rebuild and redeploy conductor binary** — three fixes pending in source: (1) `setbuf(stdout, NULL)` so logs show in journalctl instead of being buffered, (2) removed `2>/dev/null` from `start_stack` and `stack_running` so docker compose errors are visible in logs, (3) `RuntimeDirectory=qabu` in systemd service file (already deployed to server, but binary needs rebuild). Rebuild with `docker run --rm -v $(pwd)/clients_server_automation/conductor/src:/src -w /src gcc:latest g++ -std=c++20 -O2 -static -s -o /src/conductor main.cpp` then scp + restart. (added 2026-04-06)

- [ ] **Migrate secrets to Infisical** — currently secrets are rsynced to VMs manually. Replace with Infisical so secrets are pulled at runtime (no rsync needed, no machine dependency). Part of the new deploy flow that replaces `deploy.sh`. (added 2026-03-28)

- [ ] **Separate code (git) from per-client data (server-owned)** — current model treats `clients/<sub>/data/` (KB, SP, greeting, capabilities) and `clients/<sub>/private/` (client-config, background, etc.) as git-tracked, but they're actually mutable runtime state edited by the admin UI. This creates a real bug: local edits deployed via rsync/compose clobber admin-made changes on the server. Decision: code lives in git and ships via docker push/pull; per-client data lives only on the VM and is backed up separately. This also paves the way for LLM-assisted editing for owners (future) and for installing Claude Code in Docker on the client VM as a stepping stone (mount only `~/app/clients/<sub>/data` + `private/` into the container; keep it scoped so it can't touch services or compose files). Sub-steps: (1) decide what happens to the demo clients currently in git (`dradamblack`, `drlipokatz`) — either keep them purely as seed fixtures under `services/config/files/` or a `seeds/` dir, or remove them from git entirely and spin up fresh in QA from the template; (2) set up a backup job (cron + tar + Cloudflare R2 or Backblaze B2, ~15 lines) for `~/app/clients/*/data` and `~/app/clients/*/private` **before onboarding the first real client** — don't leave backup as "future" once prod has a paying customer; (3) update the deploy flow docs so the code/data split is explicit; (4) install Claude Code in Docker on the client VM with a narrow mount scope and a container-local CLAUDE.md that restricts it to editing KB/SP only. Context: came up while discussing the current loop (simulate conversation → ask Claude locally to improve SP → rsync → retry). Roy pushed back that the real problem is the git-as-source-of-truth model for client data, not the loop latency. (added 2026-04-19)

_Future_:
- [ ] **When switching to Anthropic as LLM provider** — update `prod_setup/main_server/srv/privacy/index.html` Third-Party Processors section to add Anthropic, Inc. alongside Google and Groq. One extra `<li>` with a link to their privacy policy. (added 2026-03-15)
- [ ] **When incorporating** — replace "independent service operated by its founders, based in Israel" in both `prod_setup/main_server/srv/privacy/index.html` and `prod_setup/main_server/srv/terms/index.html` with the registered company name. Have a lawyer review both documents at that point. (added 2026-03-15)

- [ ] Check the credit on the langing page. I don't think its correct.
- [ ] Add availability check in the langind page to see if the .qabu.net page for the wanted subdomain is free. Can improve sales.

 - [ ] Review the changes of changing the sp to js from json. I don't think it good.

 - [ ] I don't think I want the widget to be shared. see the production server to understand. it should have version.
 - [ ] What about the 404 page? And what about a page that the name is already taken but site not active? 
 - [ ] Do I want the gatway volume? can we use existing one? 
 - [ ] See the Gemini report - add 'docs' and add the report there. What else need to go to docs? Copy the design directory from rny3_docs
 - [ ] Why do we need the /admin/chatQA ? it can just be /admin ? 
 - [ ] Why do we need prod_setup/client_server/dradamblack/data/services.json ? The single point of truth should be the docker-compose

 - [ ] Create a Facebook page for Dr Adam Black.
 - [ ] For the onbording site - add config for the rates (of using LLM)
 - [ ] Finish skills - UI skill with colors
 - [ ] Finish skills - Customaize the prompt engineer skill to be Qabû-specific - how to make sure I use it all the time?
 - [ ] Try changing the knowledge_base to js file with it own JSON.stingiry funciton. Same for the sp.
 - [ ] What Nevo sent I  - see [mail](https://mail.google.com/mail/u/0/#inbox/WhctKLbvVXrBNMTCBwqFvcjcfzFdLtdQjlGfblZTDlbmrkprCsgZwRjkplvmrJVBQDZSBpQ)
 - [ ] What Nevo sent II - see [mail](https://mail.google.com/mail/u/0/#inbox/WhctKLbvVXbFBvGWJclwtWNzmkzlWHhppdMVgzplnpwMWHVnCrjkRXngmNBQNZrJVMplDkQ)
 - [ ] Create a mail for Qabu.
 - [ ] Add capability - REDIRECT (open url in a new tab)

 - [ ] I need to test the widget also as a widget. Build a demo site for the client and use the widget and test it.
    - There was a version with a shirk/grow for the widget but it's gone from the code now. Claude wrote about it in CLOUDE.md so I can get it beck in the future.
 - [ ] Add reset all changes button to the admin site (the user want to go back to the current published sp/kb/greeting)
 - [ ] Add discard button to the edit/save buttons on the admin site (user want to leave the editing mode of the text box without saving)
 - [ ] I need to enable the admin user to comment as few different users (add some images for random avatars to the docker images)
 - [ ] Text the facebook_comments and the facebook_dm in production
 - [ ] With Nevo - facebook_comments to DM per the gatekeeper decision.
 - [ ] I want to change the gatekeeper - no need for a json - replay with the answer of replay one word - IGNORE/ESCALAT.
 - [ ] SAFETY: Need to validate the /ask in case there is a override sp/kb. Like in facebook_dispatcher with the secret (check: why do we need secret in facebook_dispatcher?)
 - [ ] I want to use git worktree, after I will need one.

 - [ ] The admin will ask the prompt-composer to build for it the prompt as if it was sending it to the llm (for the See Last Prompt button)

 - [ ] Should I move the routing from the site caddy to the router caddy?
 - [ ] I the CODE_REVIEW_REPORT, the is a bug about the auth between the admin and the prompt_composer specially when the admin use an alternative prompt of knowledge_base. If I will use a shared_secret like in the facebook_dispatcher to the client servers. I have an idea to make it zero down time on key rotation.
 - [ ] Clear the code - remove old tests
 - [ ] Go over the claude bot results - https://claude.ai/code/session_015amX6XQKE6anSW2Vf9QjoU
 - [ ] Go over the claude bot results - https://claude.ai/code/session_013buYQPiU1E2Fyo9qYzqSCK
 - [ ] Review the QABU-VISION

- [ ] Check the last changes:
    - [ ] Also make the 'clear function save the old chat for reference'
    - [ ] some thoughts -
        * The widget is the state. I should think of it as the real AI/person/assistant and the prompt_composer is just a resource.
          So It will also ask the prompt_composer for stuff to keep the user engaged, play the greeting and so on. The widget is the initiator.

- [ ] Organize my desk

- [ ] *Continuous improvement:*
    - [ ] *network of agents:*
        - [ ] Plan the network - not just gatekeeper and main.
    - [ ] Create Qabu for Vered and Irena and a third demo one.
    - [ ] API For Qabu to 'control' the site (see the Qabu for Qabu for detail on MVP)
    - [ ] Change the site to be node.js, instead of just Caddy (Do I still need the caddy??)

- [ ] *Build Qabu for Qabu:*
    - [x] Qabu logo
    - [ ] Video Demo
    - [ ] Buy the domain (`qabu.co.il` or `qabu.net`?) (I bought qabu.net, and I want the co.il one also)
    - [ ] Qabu js interface: Movie clip, form to input phone number, form to pay.
    - [ ] links to demos
    - [ ] improve the 404 on `./services/router/src/Caddyfile`
    - [ ] Security hardening  - Only allow Cloudflare IP addresses at your origin.

## Backlog
 - [ ] Should I move to podman?

- Facebook:
    - [ ]  Multi-page per client support

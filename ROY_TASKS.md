# Roy's Tasks
 - [ ] Delete the `router` image in GitLab
 - [ ] Next meeting with Nevo - show the langind page.

- [ ] Finish the client-onboarding
- [ ] Build a local integration test environment — Docker network with service containers + wiremock (to stub external calls like VM endpoints) + browser container for visual testing. Host uses Wayland so X11 forwarding won't work — use a VNC-based approach instead (e.g. `selenium/standalone-chrome` with noVNC, access via `localhost:7900` in host browser). Keeps coming up: hard to test end-to-end flows (like onboarding success → redirect) locally without real infrastructure. Invest in this once there are enough flows to justify it. (added 2026-03-28)
- [ ] Finish the file-provide patter in the docker-compose (the widget not in 'share' solution)

- [ ] **Update provisioner to use conductor socket** — now that conductor handles client creation (filesystem + docker), the provisioner (`services/provisioner/src/server.js`) needs to be rewritten to: validate the secret + subdomain, then forward to conductor via Unix socket at `/run/qabu/conductor.sock` (mount it in the provisioner container). The provisioner keeps HTTP, auth, and validation; conductor does everything else. (added 2026-03-30)

- [ ] **Delete `prod_setup/`** — deprecated now that clients live under `~/app/clients/` on the server directly. Roy confirmed the production server has already been migrated. Remove the directory and update CLAUDE.md accordingly. (added 2026-03-30)

- [ ] **Write a "New Server Setup" guide** — document the full steps to provision a new Oracle Cloud VM for Qabu: install Docker, build + install the conductor binary, install `qabu-conductor.service`, set up Caddy TLS, etc. Replace references to `deploy.sh` and `prod_setup/`. Lives in `docs/` or a `SETUP.md`. (added 2026-03-30)

- [ ] **Rebuild and redeploy conductor binary** — three fixes pending in source: (1) `setbuf(stdout, NULL)` so logs show in journalctl instead of being buffered, (2) removed `2>/dev/null` from `start_stack` and `stack_running` so docker compose errors are visible in logs, (3) `RuntimeDirectory=qabu` in systemd service file (already deployed to server, but binary needs rebuild). Rebuild with `docker run --rm -v $(pwd)/clients_server_automation/conductor/src:/src -w /src gcc:latest g++ -std=c++20 -O2 -static -s -o /src/conductor main.cpp` then scp + restart. (added 2026-04-06)

- [ ] **Conductor doesn't copy secrets to new clients** — `create_client()` copies the config template to the client dir, but the template has no `secrets/` directory. Currently secrets must be manually copied to each new client (`~/app/clients/<sub>/secrets/`). Will be resolved when Infisical is set up — secrets will be pulled at runtime instead of living on disk. (added 2026-04-06)

- [ ] **Migrate secrets to Infisical** — currently secrets are rsynced to VMs manually. Replace with Infisical so secrets are pulled at runtime (no rsync needed, no machine dependency). Part of the new deploy flow that replaces `deploy.sh`. (added 2026-03-28)

_Future_:
- [ ] **When switching to Anthropic as LLM provider** — update `prod_setup/main_server/srv/privacy/index.html` Third-Party Processors section to add Anthropic, Inc. alongside Google and Groq. One extra `<li>` with a link to their privacy policy. (added 2026-03-15)
- [ ] **When incorporating** — replace "independent service operated by its founders, based in Israel" in both `prod_setup/main_server/srv/privacy/index.html` and `prod_setup/main_server/srv/terms/index.html` with the registered company name. Have a lawyer review both documents at that point. (added 2026-03-15)

- [ ] Check the credit on the langing page. I don't think its correct.
- [ ] Add availability check in the langind page to see if the .qabu.net page for the wanted subdomain is free. Can improve sales.

 - [x] This warning when deploying:
 ``` 
 1 warning found (use docker --debug to expand):
 - JSONArgsRecommended: JSON arguments recommended for CMD to prevent unintended behavior related to OS signals (line 10)
 ```

 - [x] Fix the admin secret read on prompt composr (we don't need the fs.existsSync)
 - [ ] Review the changes of changing the sp to js from json. I don't think it good.

 - [ ] Check if the admin and the site share assets  - like the bg images of the html itslef. if not it will be hard to maintain.

 - [ ] **Restructure client directories: `/public`, `/data`, `/admin`, `/logs`** — While discussing widget layout fixes and which services mount assets, we realized the current `assets/` folder mixes public files (profile-pic, client-config) with admin-only files (mock_facebook, background, og-meta). New structure:
   - `public/` — only what the widget/browser needs publicly (profile-pic, minimal client-config with just direction/lang). Served by services-router at `/assets/*` (rename route to `/public/*`).
   - `admin/` — admin + site content (background, og-meta, mock_facebook/, full client-config with title/font/socialLinks). Behind auth.
   - `data/` — prompt-composer config (SP, KB, greeting, capabilities, config.env). Admin no longer mounts this.
   - `logs/` — system output (last_prompt.json). Separates "things humans edit" from "things the system writes."
   - Rule: if it must be publicly accessible → `public/`. If not → `admin/`. Think carefully about what goes in `public/client-config.json` — minimum data only.
   - Requires updating: config template, per-client docker-compose, services-router Caddyfile, site/admin/widget code, conductor. (added 2026-04-09)
 - [ ] I don't think I want the widget to be shared. see the production server to understand. it should have version.
 - [x] The gatway Caddyfile - can we make it more generic? so we don't need to edit when add/remove services.
 - [ ] What about the 404 page? And what about a page that the name is already taken but site not active? 
 - [ ] Do I want the gatway volume? can we use existing one? 
 - [x] Need to review the ./deploy.sh. I dosn't make sense.
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
 - [x] I don't like what Claude did with the CLIENT env var in the mock facebook. I want the volume to use the production data/srv to display the correct post-comments mock UI.
 - [x] Make facebook comment prompt fit the OpenAI api. no time stamp - just (a long time ago) ... make sure we know who is the assistant. How the hell this is working right now????
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

- [ ] .gitignore on prod_setup (?!)
- [ ] Organize my desk
- [ ] Make sure I have all the secrets backed up

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


- [ ] *Claude skills*:
    1. superpowers — teaches Claude better development patterns globally
    1. skill-creator — for building your Qabû-specific skills
    1. security-guidance — healthcare context, install early
    1. code-review — everyday value
    1. claude-md-management — keeps your CLAUDE.md healthy
    1. playwright — when you're ready to add UI tests
    1. frontend-design — for the chat/canvas UI work
    1. code-simplifier — good for keeping things lean

# The Qabu Project
-------

## Roy's Tasks

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

# Claude's Tasks

- [ ] **Fix trailing SLEEP action in LLM responses.** The LLM sometimes appends a standalone `|| SLEEP 2500` as the last (or only) action in its response, even when there's no subsequent UI action to follow. This happens because the capabilities instructions in the system prompt say "use SLEEP before UI actions to give the user time to read the message" — the model learns the `SLEEP → CONTACT_FORM` pattern and then over-applies it, treating SLEEP as a generic "let the user read" signal rather than a delay *before another action*. It's harmless (just adds a pointless 2.5s pause) but wasteful. The fix is to clarify in the capabilities section of the system prompt that SLEEP should only be used when followed by another action, never as the last action. Suggested wording: "השתמש ב-SLEEP רק לפני פעולה נוספת (כמו CONTACT_FORM) כדי לתת למשתמש זמן לקרוא. אל תשתמש ב-SLEEP כפעולה אחרונה — אין בכך תועלת." Use the `qabu-prompt-engineer` skill when making this fix.

- [ ] **Optimize system prompts for Gemini (both dradamblack and drlipokatz).** A review against Gemini prompt engineering best practices found several issues in the system prompts. Apply all changes to both clients — dradamblack (EN) and drlipokatz (HE). Use the `qabu-prompt-engineer-gemini` skill when making these changes.
    - **Add few-shot examples to both gatekeepers (widget + facebook_comments).** Gemini docs say "prompts without examples are likely less effective." Classification tasks benefit hugely from examples. Add 2-3 positive examples to each gatekeeper showing the expected input→output. For the widget gatekeeper: one business question → ESCALATE, one greeting → short warm reply, one gibberish → IGNORE. For the facebook_comments gatekeeper: one supportive comment → warm reply, one spam → IGNORE, one question → ESCALATE.
    - **Add few-shot examples to facebook_comments main prompt.** Currently has zero examples. Add 1-2 examples showing the expected tone, length (2-3 sentences), and pattern of directing to private message or phone for medical details.
    - **Add explicit grounding instruction to widget.main.** Currently says "Never fabricate information that is not in the knowledge base" which is good but not strong enough for Gemini. Add the recommended grounding block near the top of the Critical Rules section: "Reply only using the information provided in the knowledge base. Do not use your own knowledge. If the answer is not explicitly in the knowledge base, state that the information is not available."
    - **Move "Good Conversation Examples" section lower in widget.main.** Currently the examples appear early (after Conversation Rules), before Conversation Tracking, Conversion, Emergency Signs, Insurance Guidelines, and the KB. Per Gemini guidelines, examples should come after context/instructions. Move the examples section to just before the capabilities instructions — i.e. after Insurance Guidelines but before the capabilities block. This way the model reads all the rules first, then sees examples that demonstrate those rules, then gets the KB.
    - **Remove insurance data duplication from widget.main SP.** The `# Insurance Guidelines` section in the SP repeats dollar amounts, insurer names, and coverage details that are already in the KB entry "Costs and Insurance" / "Patient Information: Clinic, Insurance & Costs". When both exist, the model might give inconsistent answers depending on which it reads. Refactor the SP section to contain only *behavioral* rules (e.g. "ask about insurance before quoting costs", "for out-of-network patients suggest private insurance") and remove the duplicated data (insurer names, dollar amounts, coverage levels). Let the KB be the single source of truth for insurance facts.
    - **Add a final instruction anchor via prompt-composer.** The composed prompt currently ends with raw KB content — no closing instruction. After the KB section, the prompt-composer should append a one-line anchor like: `Based on the knowledge base above, respond to the user's latest message.` This helps Gemini focus on the task. This requires a small change in `services/prompt_composer/src/server.js` where the prompt is assembled — add the anchor line after the KB block. Check the prompt-composer code to find the exact spot.
    - **[Low priority / future] Move KB before examples in prompt-composer.** The Gemini guideline says context (KB) should come BEFORE examples and task. Currently the prompt-composer appends KB at the very end: `main + capabilities_instructions + #CAPABILITIES + #KNOWLEDGE BASE`. Ideally the order would be: `main_part1 (role+instructions) + #KNOWLEDGE BASE + main_part2 (examples) + capabilities`. This is a bigger architectural change — would require splitting the `main` SP into two parts or having the prompt-composer insert KB at a marked position. Not urgent since the current setup works, but worth considering for a future refactor.



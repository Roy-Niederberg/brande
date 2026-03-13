# Roy's Tasks

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

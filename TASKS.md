# The Qabu Project
-------
- [ ] Should I move the routing from the site caddy to the router caddy?
 - [ ] I the CODE_REVIEW_REPORT, the is a bug about the auth between the admin and the prompt_composer specially when the admin use an alternative prompt of knowledge_base. If I will use a shared_secret like in the facebook_dispatcher to the client servers. I have an idea to make it zero down time on key rotation.
 - [ ] Clear the code - remove old tests
 - [ ] Go over the claude bot results - https://claude.ai/code/session_015amX6XQKE6anSW2Vf9QjoU
 - [ ] Go over the claude bot results - https://claude.ai/code/session_013buYQPiU1E2Fyo9qYzqSCK

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
        - [x] Make sure the setup is what we need. MAIN with Caddy and each server with Caddy.
            - [x] The main caddy is just for facebook, maybe for google login callback.
        - [x] in `prompt_composer`, work with the json prompt.
        - [x] Somehow, I need to edit this json prompt.
        - [x] Chat background.
        - [x] Work with grok openai-oss-120b (move to 20 be if needed)
        - [x] Deploy CraftKids and Dr Lipo with the gatekeeper.
        - [ ] Create Qabu for Vered and Irena and a third demo one.
    - [x] Create a starter message for each client (The message the will start the chat. Can be timed)
    - [ ] API For Qabu to 'control' the site (see the Qabu for Qabu for detail on MVP)
    - [ ] Change the site to be node.js, instead of just Caddy (Do I still need the caddy??)

- [ ] *Build Qabu for Qabu:*
    - [x] Qabu logo
    - [ ] Video Demo
    - [x] Buy the domain (`qabu.co.il` or `qabu.net`?) (I bought qabu.net)
    - [ ] Qabu js interface: Movie clip, form to input phone number, form to pay.
    - [ ] links to demos
    - [ ] improve the 404 on `./services/router/src/Caddyfile` 
    - [ ] Security hardening  - Only allow Cloudflare IP addresses at your origin.

- [ ]    Facebook:
    - [ ]  Webhook to main (use the secret for URL?)

- [ ]    What to do with the GitHub mirror?
- [ ]  

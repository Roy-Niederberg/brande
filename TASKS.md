# The Qabu Project
-------
## with Nevo

 - [ ] Clear the code - remove old tests
 - [ ] Go over the claude bot results - https://claude.ai/code/session_015amX6XQKE6anSW2Vf9QjoU
 - [ ] Go over the claude bot results - https://claude.ai/code/session_013buYQPiU1E2Fyo9qYzqSCK

- [ ] Check the last changes:
    - [ ] Also make the 'clear function save the old chat for reference'
    - [ ] some thoughts -
        * The widget is the state. I should think of it as the real AI/person/assistant and the prompt_composer is just a resource.
          So It will also ask the prompt_composer for stuff to keep the user engaged, play the greeting and so on. The widget is the initiator.

- [ ] .gitignore on prod_setup (?!)
- [] Create site for Qabu. poc.
- [ ] Organize my desk
- [ ] Make sure I have all the secrets backed up
- [ ] Go over CLAUDE.md and read it. (in ~/tmp/qabu_CLAUDE.md)

- [ ] *Continuous improvement:*
    - [ ] *network of agents:*
        - [ ] Make sure the setup is what we need. MAIN with Caddy and each server with Caddy.
            - [ ] The main caddy is just for facebook, maybe for google login callback.
        - [ ] in `prompt_composer`, work with the json prompt.
        - [ ] Somehow, I need to edit this json prompt.
        - [ ] Chat background.
        - [ ] Work with grok openai-oss-120b (move to 20 be if needed)
        - [ ] Deploy CraftKids and Dr Lipo with the gatekeeper.
        - [ ] Create Qabu for Vered and Irena and a third demo one.
    - [ ] Create a starter message for each client (The message the will start the chat. Can be timed)
    - [ ] API For Qabu to 'control' the site (see the Qabu for Qabu for detail on MVP)
    - [ ] Change the site to be node.js, instead of just Caddy (Do I still need the caddy??)

- [ ] *Build Qabu for Qabu:*
    - [ ] Qabu logo
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


I'm Roy. I'm the designer and developer of this project.
I have a partner called Nevo.
These are our emails:
  * roy.niederberg@gmail.com
  * nevokubani@gmail.com
I sometime use another email address:
  * brandelicious.il@gmail.com

The name of the project is Qabû.
Qabû is an Akkadian verb meaning “to say,” “to speak,” or “to declare.” It was commonly used in royal, legal, and religious texts in ancient Mesopotamia.
We own the domain `qabu.net`

The goal of this project is to give clients (small business like doctors and clinics) a RAG based AI agent to interact with clients via our supplied website on the "qabu.net" domain, `<client-name>.qabu.net`, a widget to incorporate in their site, their facebook page, facebook DM, WhatsApp, Telegram and emails for a monthly fee.
For example, Dr Cohen want to work with Qabû -
He register and supply as an email address (currently only gmail), we create a `drcohen.qabu.net` site.
We collect data from his current site and interview him then fill all the knowledge in `drcohen.qabu.net/admin` and adjust the prompt per his requirements. 
This will create Dr Cohen's Qabû, which will answer clients questions from the knowledge base. We would like to enable Dr Cohen's Qabû to schedule appointments, collect patients info (name, phone number..) and report Dr Cohen per need via WhatsApp/Telegram. Also we would like the Qabû to drive drive sells up, working also as a sales man for Dr Cohen.
The manual process of creating a new client should be automated in the future. A new client will register on the web, and the `<client-name>.qabu.net` will be automatically created. Then the will be redirected to `<client-name>.qabu.net/admin` and the Qabû will interview him, asking all the relevant questions to build to database.
We also want to enhance the Qabû capabilities facing the user. Not just answer questions but it can modify the DOM of the site, opening forms, showing clips, redirecting the user and so on.
Making the Qabû chat a first class citizen will separate as from existing AI chats bots integrated in websites. This will change a little bit the way website are build and use. Instead of showing the user data on the site, letting him search or ask the chat, he will first meet the Qabû chat, which will be in charge of showing the user the data that interest him.
Putting the Qabû chat in the heat of the website enable us to build and maintain many sites with ease. There is not need to design and implement the site on our side and our client just need to finish the interview with its Qabû when it is convenient to him.

Notes:
* we are not an official company. I just works as individual developer, but we plan to start a company when we need.
* We are based in Israel, so we start with Israelis clients, but we plan to be international.
* Started developing late 2025.
* The domain `qabu.net` purchased from `GoDaddy.com`
* We have two small VM on `Oracle Cloud`. One hosting the client server and one the main server. Free plan for now.
* The client server will host the clients site, backend for the client agents and hold the knowledge base for the RAG.
* The main server will be use for out main site, `qabu.net` and for staff that require a single point of contact like the Facebook web-hook.
* We use private repo on GitLab (and we have a private mirror on GitHub)
* We want to work with social login only to avoid the need to hold users and passwords.

Development philosophy:
* simple and short code are the goal. Code Files should be around 80 lines. Lines should be up to 100 characters.
* Every line of code must fight for its life and really justify its place. Otherwise we should delete it.
* I like white list gitignore, not black list.
* Avoid third party libs and dependencies as much as possible.
* Everything is in Docker containers. I don't want to install node, npm, python etc' on my host machine.

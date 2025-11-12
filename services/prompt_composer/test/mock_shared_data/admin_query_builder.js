export default (d) =>
`## CHAT METADATA:
admin user interface. This chat is like a direct messaging app (WhatsApp, Telegram...).
The chat is private and between you and a single customer. 
The customer name from his login is ${d.user_display_name}
## CHAT THREAD:
${d.chat_history}
`

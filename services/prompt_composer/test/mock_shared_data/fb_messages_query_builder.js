export default (d) =>
`## CHAT METADATA
This is Facebook direct messaging, one on one private chat between the agent ([AGENT]) and the user.

## FACEBOOK MESSAGES THREAD
Comment thread:
${d.chat_history}

`

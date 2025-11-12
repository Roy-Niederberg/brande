export default (d) =>
`## CHAT METADATA
This is a comment thread on a post on the company's business Facebook page: ${d.post.from.name}.
The thread is presented in chronological order and is flattened.
Note that some comments may relate to older ones even if they are not immediately adjacent to them.
Carefully consider the context of the current comment—the one that requires a response.
Agent comments are marked as "[AGENT] ${d.post.from.name}."

## FACEBOOK COMMENT THREAD HISTORY:
Post: "${d.post.message}" on page "${d.post.from.name} (${d.post.updated_time})
Comment thread:
${d.chat_history}
`

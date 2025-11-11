// Facebook is flattening Level 3 comments. This means that `parent.id` for a comment replaying to a
// level 3  comment will be a level 2  comment  (the parent of the actual level 3  comment which the
// user replay to).  To get the full context, we need all level 3  comments ordered by created_time.
// TODO: Edit comment above to explain how weird Facebook API for comment is.

import fs from 'fs'
import express from 'express'
const app = express()
app.use(express.json())

// =============== Util Functions ================================================================//

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const LOG = (num, e) => { console.log(`🚨 ERROR ${num} 🚨 : ${e}`); return true }
const build_query = (post, chat_history) =>
`## CHAT META DATA
This is a comment thread on a post on the company's business Facebook page: ${post.from.name}.
The thread is presented in chronological order and is flattened.
Note that some comments may relate to older ones even if they are not immediately adjacent to them.
Carefully consider the context of the current comment—the one that requires a response.
Agent comments are marked as "[AGENT] ${post.from.name}."

## FACEBOOK COMMENT THREAD HISTORY:
Post: "${post.message}" on page "${post.from.name} (${post.updated_time})

Comment thread:
${chat_history}
`

// =============== Server Loading section ========================================================//
// In this section the server should fail in case of error and not startup. ======================//

const token = `&access_token=${read_scrt('fb_page_access_token')}`
token.length > '&access_token='.length || LOG('Page Token is empty.')

const fb_url = process.env.FACEBOOK_API_URL
fb_url.length > 0 || LOG('FACEBOOK_API_URL is empty')

// =============== Endpoints =====================================================================//
// In this section the server should keep running and give the best answer it can. ===============//

app.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED')
  if (req.body.object !== 'page' && LOG(1, `${req.body.object}`)) return
  req.body.entry.forEach((entry) => {
    entry.changes.forEach((change) => {
      const { value, field } = change
      if (field       !== 'feed'    && LOG(2, 'Not a feed event')) return
      if (value?.item === 'status'  && LOG(3, 'New post')) return // 'status' means a post
      if (value?.item === 'comment' && value.from?.id !== entry.id && value.verb === 'add') {
        process_comment(value.comment_id, value.parent_id, value.post_id)
      }
    })
  })
})

const process_comment = async (comment_id, parent_id, post_id) => {

  // Get the parent of parent (of the parent_id from the webhook) in a single API call:
  const up_url = `${fb_url}${parent_id}?fields=parent{id,parent{id}}${token}`
  console.log('vvvvvvvvvvvvvvvvvvvvv Up Tree vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv')
  console.log(up_url)
  const up_ret = await fetch(up_url)
  if (!up_ret.ok && LOG(4, `${up_ret.status} ${up_ret.statusText}`)) return
  let up_tree =  await up_ret.json()
  while(up_tree.parent?.id) up_tree = up_tree.parent
  console.dir(up_tree, { depth: null, colors: true });
  console.log(up_tree.id)

  // Get the children tree of that parent comment (level 1)
  const fields = 'message,id,created_time,from,comments.limit(100)'
  const down_url = `${fb_url}${up_tree.id}?fields=${fields}{${fields}{${fields}}}${token}`
  const down_ret = await fetch(down_url)
  if (!down_ret.ok && LOG(5, `${down_ret.status} ${down_ret.statusText}`)) return
  const down_tree =  await down_ret.json()
  console.log('--------------------- Down Tree ---------------------------------------------------')
  console.dir(down_tree, { depth: null, colors: true });

  // Get the post
  const post_url = `${fb_url}${post_id}?fields=message,id,updated_time,from${token}`
  const post_ret = await fetch(post_url)
  if (!post_ret.ok && LOG(6, `${post_ret.status} ${post_ret.statusText}`)) return
  const post = await post_ret.json()
  console.log('--------------------- Post --------------------------------------------------------')
  console.dir(post, { depth: null, colors: true });

  // Formate the comment thread to a narrative formate
  const flatten = (comment) => {
    const comments = [comment]
    if (comment.comments?.data) {
      comment.comments.data.forEach(c => comments.push(...flatten(c)))
    }
    return comments
  }

  const allComments = flatten(down_tree).sort((a, b) =>
    new Date(a.created_time) - new Date(b.created_time)
  )

  const formate_date = (iso) => {
    const d = new Date(iso)
    const month = d.toLocaleString('en-US', { month: 'short' })
    const day = d.getDate()
    const hour = d.getUTCHours().toString().padStart(2, '0')
    const min = d.getUTCMinutes().toString().padStart(2, '0')
    return `${month} ${day}, ${hour}:${min}`
  }

  const lines = allComments.map((c) => {
    const author = c.from?.name
      ? `${c.from?.name === post.from.name ? '[AGENT] ' : ''}${c.from?.name}` 
      : 'Unknown user'
    const date = formate_date(c.created_time)
    const message = c.message.replace(/\s+/g, ' ').trim()
    return `- ${author} (${date}): "${message}"`
  })
  lines[lines.length - 1] += ' [CURRENT COMMENT - RESPOND TO THIS]'

  const query = build_query(post, lines.join('\n'))
  console.log('--------------------- Query -------------------------------------------------------')
  console.log(query)

  const llm_ret = await fetch(`http://prompt-composer:4321/ask?query=${encodeURIComponent(query)}`)
  if (!llm_ret.ok && LOG(7, `${llm_ret.status} ${llm_ret.statusText}`)) return
  const answer = await llm_ret.text()
  console.log('--------------------- Answer ------------------------------------------------------')
  console.log(answer)

  // Reply to Facebook on the original comment
  const reply_url = `${fb_url}${comment_id}/comments?message=${encodeURIComponent(answer)}&access_token=${token}`
  const reply_response = await fetch(reply_url, { method: 'POST' })
  if (!reply_response.ok && LOG(8, `${reply_response.status} ${reply_response.statusText}`)) return
  const reply_data = await reply_response.json()
  console.log(`✅ Reply posted to Facebook (ID: ${reply_data.id})`)
  console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
  console.log('\n')
}

app.listen(3210, () => console.log('Server Start Up'))

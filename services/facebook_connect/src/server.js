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

// =============== Server Loading section ========================================================//
// In this section the server should fail in case of error and not startup. ======================//

const access = `access_token=${read_scrt('fb_page_access_token')}`
access.length > 'access_token='.length || LOG(0, 'Page Token is empty.')

const fb_url = process.env.FACEBOOK_API_URL
fb_url.length > 0 || LOG(0, 'FACEBOOK_API_URL is empty')

// =============== Endpoints =====================================================================//
// In this section the server should keep running and give the best answer it can. ===============//

app.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED')
  const { page_id, changes } = req.body
  changes.forEach((change) => {
    const { value, field } = change
    if (field       !== 'feed'    && LOG(2, 'Not a feed event')) return
    if (value?.item === 'status'  && LOG(3, 'New post')) return // 'status' means a post
    if (value?.item === 'comment' && value.from?.id !== page_id && value.verb === 'add') {
      process_comment(value.comment_id, value.parent_id, value.post_id, page_id)
    }
  })
})

const process_comment = async (comment_id, parent_id, post_id, page_id) => {
  // Get the level 1 comment (the comment on the post):
  let level1_comment = comment_id  // if the comment itself is L1
  if (parent_id !== post_id) {     // if the parent not the post, it's not L1 and we need go up.
    // parent of parent (of the parent_id from the webhook) in a single API call:
    const up_url = `${fb_url}${parent_id}?fields=parent{id,parent{id}}&${access}`
    console.log('--------------------- Up Tree ---------------------------------------------------')
    console.log(up_url)
    const up_ret = await fetch(up_url)
    if (!up_ret.ok && LOG(4, `${up_ret.status} ${up_ret.statusText}`)) return
    let up_tree =  await up_ret.json()
    while(up_tree.parent?.id) up_tree = up_tree.parent
    console.dir(up_tree, { depth: null, colors: true });
    console.log(up_tree.id)
    level1_comment = up_tree.id
  }

  // Get the children tree of that level 1 comment
  const fields = 'message,id,created_time,from,comments.limit(100)'
  const down_url = `${fb_url}${level1_comment}?fields=${fields}{${fields}{${fields}}}&${access}`
  const down_ret = await fetch(down_url)
  if (!down_ret.ok && LOG(5, `${down_ret.status} ${down_ret.statusText}`)) return
  const down_tree =  await down_ret.json()
  console.log('--------------------- Down Tree ---------------------------------------------------')
  console.dir(down_tree, { depth: null, colors: true });

  // Get the post
  const post_url = `${fb_url}${post_id}?fields=message,id,updated_time,from&${access}`
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

  const chat_history = allComments.map((c) => {
    const author = c.from?.name
      ? `${c.from?.name === post.from.name ? '[AGENT] ' : ''}${c.from?.name}` 
      : 'Unknown user'
    const date = formate_date(c.created_time)
    const message = c.message.replace(/\s+/g, ' ').trim()
    return `- ${author} (${date}): "${message}"`
  }).join('\n')

  console.log('--------------------- Query -------------------------------------------------------')
  console.log(chat_history)

  const llm_res = await fetch('http://prompt-composer:4321/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({module: 'facebook_comments', chat_data: { post, chat_history } })
  })
  if (!llm_res.ok && LOG(7, `${llm_res.status} ${llm_res.statusText}`)) return
  const answer = await llm_res.text()
  console.log('--------------------- Answer ------------------------------------------------------')
  console.log(answer)

  // Reply to Facebook on the original comment
  const rep_url = `${fb_url}${comment_id}/comments?message=${encodeURIComponent(answer)}&${access}`
  const public_res = await fetch(rep_url, { method: 'POST' })
  if (!public_res.ok && LOG(8, `${public_res.status} ${public_res.statusText}`)) return
  console.log(`✅ Publicly Reply to Facebook`)

  // Send private reply to the commenter
  const private_res = await fetch( `${fb_url}${page_id}/messages?${access}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: comment_id },
      message: { text: answer }
    })
  })
  if (!private_res.ok 
    && LOG(9, `${private_res.status} ${private_res.statusText} ${await private_res.text()}`)) return
  console.log(`✅ Private reply sent to Facebook user`)

  console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
  console.log('\n')
}

app.listen(3210, () => console.log('Server Start Up'))

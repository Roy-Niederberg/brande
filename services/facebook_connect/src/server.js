//--------------------------------------------------------------------------------------------------
const fs = require('fs');
const express = require('express');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const token = read_scrt('fb_page_access_token')
const fb_url = process.env.FACEBOOK_API_URL
fb_url .length > 0 || console.error('🚨 FACEBOOK_API_URL is empty 🚨 ')
const comment_fields_list = 'fields=id,message,from,parent{id},created_time'
const post_fields_list = 'fields=id,message,from,created_time'

app.use(express.json());
const LOG = (e) => { console.log(`🚨 ERROR 🚨 : ${e}`); return true }
const format_mssg = (cmt) => `<<<${cmt.created_time}>>> <<<${cmt.from?.name}>>>: ${cmt.message}`


app.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  const body = req.body
  if (body.object !== 'page') {
    console.log('Webhook object is not page, it is:', body.object);
    return;
  }

  body.entry.forEach((entry) => {
    const pageId = entry.id
    entry.changes.forEach((change) => {
      if (change.field !== 'feed' && LOG(1)) return
      if (change.value?.item === 'status' && LOG(2)) return // 'status' means a post
      if (change.value?.item === 'comment'
        && change.value.from?.id !== pageId
        && change.value.verb === 'add'
      ) process_comment(change.value.comment_id, change.value.post_id)
    })
  })
})

async function process_comment(comment_id, post_id) {
  // Facebook is flattening Level 3 comments.  This means that  `parent.id` for a comment replaying
  // to a level 3 comment will be a level 2 comment (the parent of the actual level 3 comment which
  // the user replay to).  So, to get the full  context,  we need all level 3  comments  ordered by
  // created_time.
  // TODO: Edit comment above to explain the weird way Facebook API for comment is operating.

  //const orig_comment_id = comment_id

  // finding the top level comment (comment on the post) which is an ancestor of current comment
  while (comment_id) {
    const ret = await fetch(`${fb_url}/${comment_id}?fields=parent{id}&access_token=${token}`)
    if (!ret.ok && LOG(`3 ${ret.status} ${ret.statusText} ${await ret.text()}`)) return
    comment_id = (await ret.json()).parent?.id;
  }

  // Fetch the tree of the ancestor
  const a_ret = await fetch(`${fb_url}/${comment_id}?fields=id,message,from,comments{id,message,from,comments{id,message,from,comments}}&access_token=${token}`)
  if (!a_ret.ok && LOG(`8 ${a_ret.status} ${a_ret.statusText} ${await a_ret.text()}`)) return
  const comments_tree = await a_ret.json()
  console.log('==================================================')
  console.log(comments_tree)
  console.log('==================================================')

  // Fetch the Post
  const ret = await fetch(`${fb_url}/${post_id}?${post_fields_list}&access_token=${token}`)
  if (!ret.ok && LOG(`6 ${ret.status} ${ret.statusText} ${await ret.text()}`)) return
  const post = await ret.json()
  post.comments.data = [comments_tree]
  console.log('==================================================')
  console.log(post) // Here I need to process the 'post' for the LLM
  console.log('==================================================\n\n\n')

  // Create the query and ask the prompt-composer for answer
  //let query = `# CHAT METADATA:\nThe chat is from the business Facebook page and you are replaying on a comment thread on a public post. Your previous messages on the chat will appear under the name "${post.from?.name}"\n\n`
  //query = query + "# CHAT\n" + chat_history.join('\n') + "\n\n"
  //console.log(query)
  //
  //const llm_ret = await fetch(`http://prompt-composer:4321/ask?query=${encodeURIComponent(query)}`)
  //if (!llm_ret.ok && LOG(`4 ${llm_ret.status} ${llm_ret.statusText}`)) return
  //const answer = await llm_ret.text()

  // Feplay on the original comment
  //const reply_url = `${fb_url}/${orig_comment_id}/comments?message=${encodeURIComponent(answer)}&access_token=${token}`
  //const reply_response = await fetch(reply_url, { method: 'POST' })
  //if (!reply_response.ok && LOG(`5 ${reply_response.status} ${reply_response.statusText}`)) return
  //const reply_data = await reply_response.json()
  //console.log(`✅ Reply posted to Facebook (ID: ${reply_data.id})`)
}

app.listen(3210, ()=> console.log('Server Start Up'))
//--------------------------------------------------------------------------------------------------

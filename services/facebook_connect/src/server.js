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
        && change.verb == 'add'
      ) process_comment(change.value)
    })
  })
})

async function process_comment(comment) {
  const comment_id = comment.comment_id
  let chat_history = [format_comment(comment)]

  while (comment.parent_id !== comment.post_id) {
    console.log(comment)
    const url = `${fb_url}/${comment.parent_id}?${comment_fields_list}&access_token=${token}`
    const ret = await fetch(url)
    if (!ret.ok && LOG(`3 ${ret.status} ${ret.statusText} ${await ret.text()}`)) return
    comment = await ret.json();
    chat_history.unshift(format_comment(comment))
  }

  const url = `${fb_url}/${comment.post_id}?${post_fields_list}&access_token=${token}`
  const ret = await fetch(url)
  if (!ret.ok && LOG(`6 ${ret.status} ${ret.statusText} ${await ret.text()}`)) return
  const post = await ret.json()
  console.log('📝 Root post:', post)
  chat_history.unshift(format_comment(post))

  let query = `# CHAT METADATA:\nThe chat is from the business Facebook page and you are replaying on a comment thread on a public post. Your previous messages on the chat will appear under the name "${post.from?.name}"\n\n`
  query = query + "# CHAT\n" + chat_history.join('\n') + "\n\n"

  const llm_ret = await fetch(`http://prompt-composer:4321/ask?query=${encodeURIComponent(query)}`)
  if (!llm_ret.ok && LOG(`4 ${llm_ret.status} ${llm_ret.statusText}`)) return
  const answer = await llm_ret.text()

  const reply_url = `${fb_url}/${comment_id}/comments?message=${encodeURIComponent(answer)}&access_token=${token}`
  const reply_response = await fetch(reply_url, { method: 'POST' })
  if (!reply_response.ok && LOG(`5 ${reply_response.status} ${reply_response.statusText}`)) return
  const reply_data = await reply_response.json()
  console.log(`✅ Reply posted to Facebook (ID: ${reply_data.id})`)
}

function format_comment(comment) {
  const time_stamp = typeof comment.created_time === 'number'
    ? new Date(comment.created_time * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC')
    : new Date(comment.created_time).toISOString().replace('T', ' ').replace('Z', ' UTC')
  return `<<<${time_stamp}>>> <<<${comment.from?.name}>>>: ${comment.message}`
}

app.listen(3210, ()=> console.log('Server Start Up'))
//--------------------------------------------------------------------------------------------------

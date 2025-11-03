//--------------------------------------------------------------------------------------------------
const fs = require('fs');
const express = require('express');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const token = read_scrt('fb_page_access_token')
const fb_url = process.env.FACEBOOK_API_URL
fb_url .length > 0 || console.error('🚨 FACEBOOK_API_URL is empty 🚨 ')
const fields_list = 'id,message,from,parent{id},created_time'

app.use(express.json());
const  LOG = () => { console.log("🚨 ERROR 🚨 "); return true }


app.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  const body = req.body
  if (body.object !== 'page') {
    console.log('Webhook object is not page, it is:', body.object);
    return;
  }

  body.entry.forEach((entry) => {
    entry.changes.forEach((change) => {
      if (change.field !== 'feed' && LOG()) return
      if (change.value?.item === 'status' && LOG()) return // 'status' means a post
      if (change.value?.item === 'comment') process_comment(change.value)
    })
  })
})

async function process_comment(comment) {
  const comment_id = comment.comment_id
  let chat_history = [format_comment(comment)]
  while (comment.parent_id) {
    const url = `${fb_url}/${comment.parent_id}?fields=${fields_list}&access_token=${token}`
    const ret = await fetch(url)
    if (!ret.ok && LOG()) break
    comment = await ret.json();
    chat_history.unshift(format_comment(comment))
    comment.parent_id = comment.parent?.id
  }

  let query = "# CHAT METADATA:\nThe chat is from the business Facebook page and you are replaying on a comment thread on a public post.\n"
  query = query + "# CHAT"
  query = query + chat_history.join('\n')
  query = query + "\n\n"

  const ret = await fetch(`http://prompt-composer:4321/ask?query=${encodeURIComponent(query)}`)
  if (!ret.ok && LOG()) return
  const answer = await ret.text()

  const reply_url = `${fb_url}/${comment_id}/comments?message=${encodeURIComponent(answer)}&access_token=${token}`
  const reply_response = await fetch(reply_url, { method: 'POST' })
  if (!reply_response.ok && LOG()) return
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

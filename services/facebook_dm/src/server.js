import fs from 'fs'
import express from 'express'
const app = express()
app.use(express.json())

// =============== Util Functions ================================================================//

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const LOG = (num, e) => { console.log(`🚨 ERROR ${num} 🚨 : ${e}`); return true }

// =============== Server Loading section ========================================================//
// In this section the server should fail in case of error and not startup. ======================//

const page_token = read_scrt('fb_page_access_token')
page_token.length > 0 || LOG(0, 'Page Token is empty.')
const access = `access_token=${page_token}`

const fb_url = process.env.FACEBOOK_API_URL
fb_url.length > 0 || LOG(0, 'FACEBOOK_API_URL is empty')

// =============== Endpoints =====================================================================//
// In this section the server should keep running and give the best answer it can. ===============//
console.log("started....")

app.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED')
  const { page_id, messaging } = req.body
  messaging.forEach((event) => {
    if (event.message?.text && !event.message.is_echo) {
      process_message(event.sender.id, event.message.text, page_id)
    }
  })
})

const process_message = async (psid, message_text, page_id) => {
  console.log(`📩 Message from ${psid}: "${message_text}"`)

  // Fetch conversation ID by PSID
  const conv_url = `${fb_url}${page_id}/conversations?fields=participants&${access}`
  const conv_res = await fetch(conv_url)
  if (!conv_res.ok && LOG(2, `${conv_res.status} ${conv_res.statusText}`)) return
  const conversations = await conv_res.json()
  const conversation = conversations.data?.find(c =>
    c.participants?.data?.some(p => p.id === psid)
  )
  if (!conversation && LOG(3, 'Conversation not found')) return

  // Fetch all messages from conversation
  const msg_url = `${fb_url}${conversation.id}/messages?fields=message,from,created_time&${access}`
  const msg_res = await fetch(msg_url)
  if (!msg_res.ok && LOG(4, `${msg_res.status} ${msg_res.statusText}`)) return
  const messages = await msg_res.json()

  // Format chat history
  const chat_history = messages.data?.reverse().map(m => {
    const author = m.from?.id === page_id ? '[AGENT]' : `User ${psid}`
    const time = new Date(m.created_time).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    return `- ${author} (${time}): "${m.message}"`
  }).join('\n') || ''

  console.log('--------------------- Chat History -----------------------------------------------')
  console.log(chat_history)

  // Get LLM response
  const llm_res = await fetch('http://prompt-composer:4321/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module: 'facebook_messages', chat_data: { chat_history } })
  })
  if (!llm_res.ok && LOG(5, `${llm_res.status} ${llm_res.statusText}`)) return
  const answer = await llm_res.text()
  console.log('--------------------- Answer -----------------------------------------------------')
  console.log(answer)

  // Send reply
  const reply_url = `${fb_url}me/messages?${access}`
  const reply_res = await fetch(reply_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: 'RESPONSE',
      message: { text: answer }
    })
  })
  if (!reply_res.ok && LOG(6, `${reply_res.status} ${reply_res.statusText}`)) return
  console.log(`✅ Reply sent to ${psid}`)
  console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
  console.log('\n')
}

app.listen(3220, () => console.log('Facebook DM Service Started'))

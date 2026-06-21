import fs from 'fs'

// ------------------------------------------------------------------------------------------------
// Notifier — once a day emails the raw new entries of ./logs/events.jsonl (appended by
// prompt-composer) to the ./data/notify.json recipients via Resend. No parsing: the log text is
// sent verbatim. To track "what's new" it drains the log — at send time events.jsonl is renamed
// to events.sending (atomic, so concurrent appends land in a fresh log), emailed, then deleted
// only after a successful send. A failed send keeps events.sending for next-cycle retry.
// It is a HEARTBEAT: the send always fires every 24h, even with an empty log (empty mail). That
// way silence in Roy's inbox always means a real failure, not just a quiet client.
// ------------------------------------------------------------------------------------------------
const API_KEY   = fs.readFileSync('/run/secrets/resend_api_key', 'utf-8').trim()
const SEND_HOUR = 12
const SEND_MIN  = 0
const EVENTS    = './logs/events.jsonl'
const SENDING   = './logs/events.sending'

const send = async text => {
  const title = JSON.parse(fs.readFileSync('./private/client-config.json', 'utf-8')).title
  const to    = JSON.parse(fs.readFileSync('./data/notify.json', 'utf-8')) // read per send — live edits
  if (!to.length) throw new Error('notify.json has no recipients')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: 'Qabu <notifications@qabu.net>', to,
      subject: `Qabû — ${title} — daily digest`, text: text || '\n'}) // Resend 422s on '' — coerce
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

const msUntilNextSend = () => {
  const target = new Date()
  target.setHours(SEND_HOUR, SEND_MIN, 0, 0)
  if (target <= new Date()) target.setDate(target.getDate() + 1)
  return target - new Date()
}

const tick = async () => {
  try {
    if (!fs.existsSync(SENDING) && fs.existsSync(EVENTS)) fs.renameSync(EVENTS, SENDING)
    const text = fs.existsSync(SENDING) ? fs.readFileSync(SENDING, 'utf-8') : ''
    await send(text)                                   // always fires — empty mail = "no activity"
    if (fs.existsSync(SENDING)) fs.unlinkSync(SENDING)  // only after a successful send; a throw keeps it for retry
    console.log('Sent daily digest')
  } catch (e) { console.error('🚩', e.message) }
  setTimeout(tick, msUntilNextSend())
}

setTimeout(tick, msUntilNextSend())
console.log(`Notifier Start Up — next send in ${Math.round(msUntilNextSend() / 60000)} min`)

import fs from 'fs'
import express from 'express'

const app = express()
app.set('trust proxy', true)

const emails = JSON.parse(fs.readFileSync('/run/secrets/authorized_emails', 'utf-8').trim()).emails
app.use((rq, rs, nx) => {
  if (!emails) return nx()
  if (!emails.includes(rq.headers['x-auth-email'])) return rs.sendStatus(403)
  nx()
})

app.get('/', (_, rs) => rs.sendFile('/app/views/index.html'))

// Normalize both event schemas — pre-v1 {outcome, model} lines and v1
// flag-style lines (gk/main/ignore/error) — into one shape for the page.
// (A transitional schema wrote the literal reply 'IGNORE' instead of a flag.)
const reply = e => e.res ?? e.reply ?? (typeof e.gk === 'object' ? e.gk.res : undefined)
const outcome = (e, res) =>
  e.error ? 'error'
  : e.ignore || e.outcome === 'ignore' || res === 'IGNORE' ? 'ignored'
  : e.main || e.outcome === 'main' ? 'main'
  : e.gk || e.outcome === 'gatekeeper' ? 'gatekeeper'
  : 'other'

app.get('/api/events', (_, rs) => {
  let config = {}
  try { config = JSON.parse(fs.readFileSync('/app/private/client-config.json', 'utf-8')) } catch {}
  let lines = []
  try { lines = fs.readFileSync('/app/logs/events.jsonl', 'utf-8').split('\n').filter(Boolean) } catch {}
  const events = []
  for (const line of lines) {
    try {
      const e = JSON.parse(line)
      const res = reply(e)
      events.push({ ts: e.ts, channel: e.channel || 'unknown', conversation_id: e.conversation_id,
                    outcome: outcome(e, res), admin: e.admin === true, duration_ms: e.duration_ms,
                    user_mssg: e.user_mssg, res: res === 'IGNORE' ? undefined : res,
                    errors: e.errors?.length ? e.errors : undefined,
                    model: e.main ?? (typeof e.gk === 'object' ? e.gk.model : e.gk) ?? e.model })
    } catch {} // a truncated/garbled line must not kill the dashboard
  }
  rs.json({ title: config.overlayTitle || config.title || '', events })
})

app.use((e, _, rs, _nxt) => { console.error(e.message, `\n${e.stack}`); rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
// 4322 = authed port: only the services-router's /bab/* rule (behind
// forward_auth) reaches it. Listening on 4321 would expose us publicly.
app.listen(4322, () => console.log('Server Start Up'))

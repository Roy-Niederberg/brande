import fs from 'fs'
import express from 'express'
import crypto from 'crypto'
import page_routes from '../data/page_routes.json' with { type: 'json' }
const app = express()

// =============== Util Functions ===============================================================//
const secret = (name) => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const send = (rs, code, body, log) => {
  if (log) console.log(log)
  rs.status(code).send(body)
}

const verify_token      = secret('fb_webhook_verify_token')
const fb_app_secret     = secret('fb_app_secret')
const dispatcher_secret = secret('fb_dispatcher_secret')

function verify_signature(signature, rawBody) {
  if (!signature) return false
  const parts = signature.split('=')
  if (parts.length !== 2) return false

  const expected = crypto.createHmac('sha256', fb_app_secret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(expected, 'hex')
  )
}

const dispatch_to = (target, page_id, events) => {
  fetch( `https://${page_routes[page_id]}/facebook/${target}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dispatcher-secret': dispatcher_secret
    },
    body: JSON.stringify({ page_id, events })
  }).catch(err => console.error('🚩 Forward Error: ', err.message))
}

app.use(express.json({ verify: (rq, _rs, buf) => rq.rawBody = buf.toString('utf8') }))

// =============== Endpoints ====================================================================//
app.get('/', (rq, rs) => {
  console.log('Webhook verification request received')

  if (rq.query['hub.mode'] !== 'subscribe' || rq.query['hub.verify_token'] !== verify_token) {
    return send(rs, 403, {} ,'🚩 Webhook verification failed')
  }
  return send(rs, 200, {} , 'Webhook verified')
})

app.post('/', (rq, rs) => {
  if (!verify_signature(rq.headers['x-hub-signature-256'], rq.rawBody)) {
    return send(rs, 403, '🚩 Webhook Invalid signature')
  }
  send(rs, 200,'EVENT_RECEIVED', 'Webhook POST received')

  // Send the request to the relevant server
  const entries = rq.body?.entry || []
  entries.forEach(entry => {
    if (entry.changes)   dispatch_to('comments', entry.id, entry.changes)
    if (entry.messaging) dispatch_to('dm', entry.id, entry.messaging)
  })
})

app.listen(3210, () => console.log('Server Start Up'))

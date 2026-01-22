const fs = require('fs')
const express = require('express')
const crypto = require('crypto')
const axios = require('axios')
const app = express()

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const dispatch_to = (target, page_id, events) => {
  axios.post( `http://facebook-${target}-${page_id}:3210`, { page_id, events }, {
    headers: { 'content-type': 'application/json' },
  }).catch(err => {
      console.error(`Forward Error:http://facebook-${target}-${page_id}:3210:`, err.message)
    })
}

const verify_token = read_scrt('fb_global_webhook_verify_token')
const fb_app_secret = read_scrt('fb_global_app_secret')
app.use(express.json({ verify: (rq, _rs, buf) => rq.rawBody = buf.toString('utf8') }))

app.get('/', (rq, rs) => {
  const mode = rq.query['hub.mode']
  const token = rq.query['hub.verify_token']
  const challenge = rq.query['hub.challenge']

  console.log('Webhook verification request received')
  console.log('Mode:', mode)
  console.log('Token:', token)

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('✓ Webhook verified successfully!')
      rs.status(200).send(challenge)
    } else {
      console.error('✗ Webhook verification failed - token mismatch')
      rs.sendStatus(403)
    }
  } else {
    console.error('✗ Webhook verification failed - missing parameters')
    rs.sendStatus(400)
  }
})

// Dispatch POST requests based on page ID
app.post('/', (rq, rs) => {
  console.log(`Webhook POST received (${new Date()})`)
  const signature = rq.headers['x-hub-signature-256']

  if (!verifySignature(signature, rq.rawBody)) {
    console.error('✗ Invalid signature - rejecting request')
    return rs.sendStatus(403)
  }
  rs.status(200).send('EVENT_RECEIVED'); // Respond immediately to Facebook

  // Validate object type
  if (rq.body.object !== 'page') {
    console.log(`Ignoring non-page object: ${rq.body.object}`)
    return
  }

  // Loop through all entries and dispatch to corresponding services
  const entries = rq.body?.entry || []
  entries.forEach(entry => {
    if (entry.changes) dispatch_to('comments', entry.id, entry.changes)
    if (entry.messaging) dispatch_to('dm',entry.id, entry.messaging)
  })
})

function verifySignature(signature, rawBody) {
  if (!signature) {
    console.error('No signature provided')
    return false
  }

  const elements = signature.split('=')
  if (elements.length !== 2) {
    console.error('Invalid signature format')
    return false
  }

  const signatureHash = elements[1]
  const expectedHash = crypto.createHmac('sha256', fb_app_secret).update(rawBody).digest('hex')

  return signatureHash === expectedHash
}

app.listen(3210, ()=> console.log('Server Start Up'))

const fs = require('fs');
const express = require('express');
const axios = require('axios');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()

const verify_token = read_scrt('fb_global_webhook_verify_token')
app.use(express.json({ verify: (rq, _rs, buf) => rq.rawBody = buf.toString('utf8') }));

app.get('/', (rq, rs) => {
  const mode = rq.query['hub.mode'];
  const token = rq.query['hub.verify_token'];
  const challenge = rq.query['hub.challenge'];

  console.log('Webhook verification request received');
  console.log('Mode:', mode);
  console.log('Token:', token);

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('✓ Webhook verified successfully!');
      rs.status(200).send(challenge);
    } else {
      console.error('✗ Webhook verification failed - token mismatch');
      rs.sendStatus(403);
    }
  } else {
    console.error('✗ Webhook verification failed - missing parameters');
    rs.sendStatus(400);
  }
});

// Dispatch POST requests based on page ID
app.post('/', (rq, rs) => {
  const pageId = rq.body?.entry?.[0]?.id;
  console.log(`Webhook POST received - Page ID: ${pageId}`);

  // Respond immediately to Facebook
  rs.status(200).send('EVENT_RECEIVED');

  // Forward to facebook-connect (fire and forget)
  const targetUrl = `http://fb-page-${pageId}:3210`;
  axios.post(targetUrl, rq.rawBody, {
    headers: { ...rq.headers, host: undefined },
  }).catch(error => {
    console.error(`Forward error to ${targetUrl}:`, error.message);
  });
});

app.listen(3210, ()=> console.log('Server Start Up'))

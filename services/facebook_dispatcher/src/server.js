const fs = require('fs');
const express = require('express');
const axios = require('axios');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()

const verify_token = read_scrt('fb_global_webhook_verify_token')
app.use(express.json({ verify: (req, _res, buf) => req.rawBody = buf.toString('utf8') }));

app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request received');
  console.log('Mode:', mode);
  console.log('Token:', token);

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('✓ Webhook verified successfully!');
      res.status(200).send(challenge);
    } else {
      console.error('✗ Webhook verification failed - token mismatch');
      res.sendStatus(403);
    }
  } else {
    console.error('✗ Webhook verification failed - missing parameters');
    res.sendStatus(400);
  }
});

// Dispatch POST requests based on page ID
app.post('/', async (req, res) => {
  const pageId = req.body?.entry?.[0]?.id;
  console.log(`Webhook POST received - Page ID: ${pageId}`);

  try {
    const response = await axios.post(`http://${pageId}-1:3210`, req.rawBody, {
      headers: { ...req.headers, host: undefined },
    });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error(`Forward error to ${targetUrl}:`, error.message);
    res.sendStatus(error.response?.status || 500);
  }
});

app.listen(3210, ()=> console.log('Server Start Up'))

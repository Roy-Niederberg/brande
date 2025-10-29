const fs = require('fs');
const express = require('express');
const crypto = require('crypto');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
// Middleware to capture raw body for signature verification

app.use(express.json({ verify: (req, _res, buf) => req.rawBody = buf.toString('utf8') }));

const APP_SECRET = read_scrt('fb_app_secret')
const VERIFY_TOKEN = read_scrt('fb_verify_token')

// Endpoinsts
// ============================================================================
// ENDPOINT: GET /
app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request received');
  console.log('Mode:', mode);
  console.log('Token:', token);

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
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

// ENDPOINT: POST /
app.post('/', (req, res) => {
  // Verify the request signature using raw body
  const signature = req.headers['x-hub-signature-256'];

  console.log(`Received webhook POST request (${new Date()})`);

  if (!verifySignature(signature, req.rawBody)) {
    console.error('✗ Invalid signature - rejecting request');
    return res.sendStatus(403);
  }

  console.log('✓ Signature verified');

  if (req.body.object === 'page') {
    console.log('Processing page webhook event...');
    console.log('Number of entries:', req.body.entry ? req.body.entry.length : 0);

    req.body.entry.forEach((entry, entryIndex) => {
      console.log(`\nEntry ${entryIndex}:`, JSON.stringify(entry, null, 2));

      entry.changes.forEach((change) => {
        if (change.field === 'feed') {
          const value = change.value;

          console.log('Feed change detected! Item type:', value.item);

          if (value.item === 'comment') {
            console.log('\n=== New Comment Received ===');
            console.log('Comment ID:', value.comment_id);
            console.log('Post ID:', value.post_id);
            console.log('From:', value.from);
            console.log('Message:', value.message);
            console.log('Created Time:', value.created_time);
            console.log('========================\n');

            // Handle the comment here
          } else {
            console.log('Feed event but not a comment. Item type:', value.item);
          }
        } else {
          console.log('Change field is not feed, it is:', change.field);
        }
      });
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.log('Webhook object is not page, it is:', req.body.object);
    res.sendStatus(404);
  }
});

// Verify request signature
function verifySignature(signature, rawBody) {
  if (!signature) {
    console.error('No signature provided');
    return false;
  }

  const elements = signature.split('=');
  if (elements.length !== 2) {
    console.error('Invalid signature format');
    return false;
  }

  const signatureHash = elements[1];

  const expectedHash = crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody)
    .digest('hex');

  return signatureHash === expectedHash;
}

app.get('/health', (_, rs) => rs.status(200).json({ status: 'ok' }));

app.listen(3210, ()=> console.log('Server Start Up'))

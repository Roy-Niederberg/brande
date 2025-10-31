const fs = require('fs');
const express = require('express');
const crypto = require('crypto');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const fb_app_secret = JSON.parse(read_scrt('fb_global_app_secret'))

app.use(express.json({ verify: (req, _res, buf) => req.rawBody = buf.toString('utf8') }));


// Endpoinsts
// ============================================================================
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
    .createHmac('sha256', fb_app_secret)
    .update(rawBody)
    .digest('hex');

  return signatureHash === expectedHash;
}

app.listen(3210, ()=> console.log('Server Start Up'))

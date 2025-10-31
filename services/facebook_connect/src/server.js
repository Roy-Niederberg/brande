const express = require('express');
const app = express();

app.use(express.json());


// Endpoinsts
// ============================================================================
// ENDPOINT: POST /
app.post('/', (req, res) => {
  console.log(`Received webhook POST request (${new Date()})`);

  // Respond immediately (signature already verified by dispatcher)
  res.status(200).send('EVENT_RECEIVED');

  // Process webhook asynchronously
  processWebhook(req.body);
});

function processWebhook(body) {
  if (body.object !== 'page') {
    console.log('Webhook object is not page, it is:', body.object);
    return;
  }

  console.log('Processing page webhook event...');
  console.log('Number of entries:', body.entry ? body.entry.length : 0);

  body.entry.forEach((entry, entryIndex) => {
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
}

app.listen(3210, ()=> console.log('Server Start Up'))

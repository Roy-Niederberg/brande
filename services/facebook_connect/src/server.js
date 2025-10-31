const fs = require('fs');
const express = require('express');
const app = express();

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const page_access_token = read_scrt('fb_page_access_token')

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

          // Fetch full comment thread
          handleComment(value.comment_id);
        } else {
          console.log('Feed event but not a comment. Item type:', value.item);
        }
      } else {
        console.log('Change field is not feed, it is:', change.field);
      }
    });
  });
}

async function handleComment(commentId) {
  try {
    const thread = await fetchCommentThread(commentId);
    console.log('\n📜 Full Comment Thread:');
    console.log(JSON.stringify(thread, null, 2));
    console.log('---\n');
  } catch (error) {
    console.error('Error fetching comment thread:', error.message);
  }
}

async function fetchCommentThread(commentId) {
  const thread = [];
  let currentId = commentId;

  while (currentId) {
    const url = `https://graph.facebook.com/v21.0/${currentId}?fields=id,message,from,parent,created_time&access_token=${page_access_token}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch ${currentId}:`, response.status, response.statusText);
        break;
      }

      const data = await response.json();
      thread.unshift(data); // Add to beginning of array

      // Check if parent exists and is a comment (has underscore in ID)
      // Post IDs don't have underscores, comment IDs do (e.g., "123_456")
      if (data.parent?.id && data.parent.id.includes('_')) {
        currentId = data.parent.id;
      } else {
        currentId = null; // Reached the post or no parent
      }
    } catch (error) {
      console.error(`Error fetching ${currentId}:`, error.message);
      break;
    }
  }

  return thread;
}

app.listen(3210, ()=> console.log('Server Start Up'))

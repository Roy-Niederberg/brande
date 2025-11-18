import http from 'http'

// Payload in new format (as sent by dispatcher)
const webhook_payload = {
  page_id: '808626769002262',
  changes: [{
    field: 'feed',
    value: {
      from: { id: '10039794932789792', name: 'Roy Niederberg' },
      post: {
        status_type: 'mobile_status_update',
        is_published: true,
        updated_time: '2025-11-09T21:39:00+0000',
        permalink_url: 'https://www.facebook.com/122107745811055026/posts/pfbid02bTsw7smfLE1VvkfYbxEjNgptG6z987QPT1RKVeuxohuM7mve38vT5M8Z9UfCJKZ1l',
        promotion_status: 'ineligible',
        id: '808626769002262_122108640597055026'
      },
      message: 'CraftKids Toys what kind of toys are you selling?',
      post_id: '808626769002262_122108640597055026',
      comment_id: '122108640597055026_854546700290627',
      created_time: 1762724340,
      item: 'comment',
      parent_id: '122108640597055026_1178731644358181',
      verb: 'add'
    }
  }]
}

const up_tree_response = { id: '122108640597055026_1178731644358181' }

const down_tree_response = {
  "message": "hi, are you selling toys?",
  "id": "122108640597055026_1178731644358181",
  "created_time": "2025-11-08T21:02:58+0000",
  "from": {
    "name": "Roy Niederberg",
    "id": "10039794932789792"
  },
  "comments": {
    "data": [
      {
        "message": "Hi Roy, yes, we sell toys at CraftKids Toys!",
        "id": "122108640597055026_1574851560336123",
        "created_time": "2025-11-08T21:03:03+0000",
        "from": {
          "name": "CraftKids Toys",
          "id": "808626769002262"
        }
      },
      {
        "message": "CraftKids Toys and where is the store?",
        "id": "122108640597055026_1975815966325736",
        "created_time": "2025-11-08T21:03:49+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        },
        "comments": {
          "data": [
            {
              "message": "CraftKids Toys is located at 247 Maple Street, Portland, Oregon.",
              "id": "122108640597055026_3351880741618771",
              "created_time": "2025-11-08T21:03:55+0000",
              "from": {
                "name": "CraftKids Toys",
                "id": "808626769002262"
              }
            }
          ],
          "paging": {
            "cursors": {
              "before": "QVFIU3dNeXZADSWV1TkViWFNJVnp3OGoyV21WTUx6V3V1NENKUjZAsc3BYUV8yYUhBbTlKejdpbW5IS215YmtDM3ZAJNUh4LUN5aURqSWZADbWhoUTVRczQyOVhR",
              "after": "QVFIU3dNeXZADSWV1TkViWFNJVnp3OGoyV21WTUx6V3V1NENKUjZAsc3BYUV8yYUhBbTlKejdpbW5IS215YmtDM3ZAJNUh4LUN5aURqSWZADbWhoUTVRczQyOVhR"
            }
          }
        }
      },
      {
        "message": "Roy Niederberg Israel?",
        "id": "122108640597055026_702592762885558",
        "created_time": "2025-11-08T21:06:47+0000",
        "comments": {
          "data": [
            {
              "message": "I apologize, but I don't have specific information about that in my current resources. To ensure you get accurate and detailed assistance, I recommend contacting our customer service team.\nThey'll be able to help you with the question about Roy Niederberg Israel.",
                "id": "122108640597055026_1348435426974200",
              "created_time": "2025-11-08T21:06:58+0000",
              "from": {
                "name": "CraftKids Toys",
                "id": "808626769002262"
              }
            }
          ],
          "paging": {
            "cursors": {
              "before": "QVFIUzRnWlQwdkdhU21tZAXF3R2kzdjNBcG0zVWwyWENpQVpXbnBta0hmbV9XYk1XSkhxUlpycmUzNDBoUEhXV2lLZA3RWY3l6ZAktYamdDT1p2WFJmMjROdkN3",
              "after": "QVFIUzRnWlQwdkdhU21tZAXF3R2kzdjNBcG0zVWwyWENpQVpXbnBta0hmbV9XYk1XSkhxUlpycmUzNDBoUEhXV2lLZA3RWY3l6ZAktYamdDT1p2WFJmMjROdkN3"
            }
          }
        }
      },
      {
        "message": "CraftKids Toys do you have a phone number?",
        "id": "122108640597055026_1134521862228063",
        "created_time": "2025-11-08T22:37:59+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "Who is the owner?",
        "id": "122108640597055026_1686472448978358",
        "created_time": "2025-11-08T22:42:56+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        },
        "comments": {
          "data": [
            {
              "message": "The owner of CraftKids Toys is Sarah Chen.",
              "id": "122108640597055026_757538370673016",
              "created_time": "2025-11-08T22:43:03+0000",
              "from": {
                "name": "CraftKids Toys",
                "id": "808626769002262"
              }
            }
          ],
          "paging": {
            "cursors": {
              "before": "QVFIU05QbjJlc2hkQ1Q3cklZAc0pPblJnMnF6QjZAMNXlZAOXRSaVlqbnY1aER6U0JZAS3lyLW0xeHRBV0IySmM4S3FjTTE2THN4ZA0paVnJTbzllZA3FhbGNvTkRR",
              "after": "QVFIU05QbjJlc2hkQ1Q3cklZAc0pPblJnMnF6QjZAMNXlZAOXRSaVlqbnY1aER6U0JZAS3lyLW0xeHRBV0IySmM4S3FjTTE2THN4ZA0paVnJTbzllZA3FhbGNvTkRR"
            }
          }
        }
      },
      {
        "message": "When is the store open?",
        "id": "122108640597055026_1876647036577188",
        "created_time": "2025-11-08T22:49:29+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "Is the store in Portland?",
        "id": "122108640597055026_25049152734737650",
        "created_time": "2025-11-08T22:53:04+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        },
        "comments": {
          "data": [
            {
              "message": "Yes, our store is located in Portland, at 247 Maple Street.",
              "id": "122108640597055026_1388294283015745",
              "created_time": "2025-11-08T22:53:10+0000",
              "from": {
                "name": "CraftKids Toys",
                "id": "808626769002262"
              }
            }
          ],
          "paging": {
            "cursors": {
              "before": "QVFIU051US1DUExIdDhzcWNqTG1FekcySEV3VVliNmhmR2lEdTh0VmZAmMzZAXVk9wN1VvdUJ0UFN0OVhHVHNvb1QyTi1qZAWZAJS2pFUVhZAeUpJOWJJcGV3RXVn",
              "after": "QVFIU051US1DUExIdDhzcWNqTG1FekcySEV3VVliNmhmR2lEdTh0VmZAmMzZAXVk9wN1VvdUJ0UFN0OVhHVHNvb1QyTi1qZAWZAJS2pFUVhZAeUpJOWJJcGV3RXVn"
            }
          }
        }
      },
      {
        "message": "CraftKids Toys is she the only one?",
        "id": "122108640597055026_1153645740078918",
        "created_time": "2025-11-09T09:40:23+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "She has no partners?",
        "id": "122108640597055026_1923823915146155",
        "created_time": "2025-11-09T09:47:25+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "Maybe Danny?",
        "id": "122108640597055026_1487811305831657",
        "created_time": "2025-11-09T10:00:27+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "Or Lenny?",
        "id": "122108640597055026_1949067595650136",
        "created_time": "2025-11-09T10:09:30+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "CraftKids Toys is she alone 😔?",
        "id": "122108640597055026_1135839945370529",
        "created_time": "2025-11-09T17:17:59+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "CraftKids Toys what is the phone number?",
        "id": "122108640597055026_687417794108233",
        "created_time": "2025-11-09T21:29:31+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      },
      {
        "message": "CraftKids Toys what kind of toys are you selling?",
        "id": "122108640597055026_854546700290627",
        "created_time": "2025-11-09T21:39:00+0000",
        "from": {
          "name": "Roy Niederberg",
          "id": "10039794932789792"
        }
      }
    ],
    "paging": {
      "cursors": {
        "before": "QVFIUzh0QURCekZANX2Qzc1JWYjNPRU00V3ZAESXhGVHlkRVpUQzl4aXBMMUJLazN3c3VBd2I3UDVWUUVWX1Q5amR4NzY0WUt4WmhnTkotdVNNZAk1RTUh4M1h3",
        "after": "QVFIU182Mnp2SDRHR2NaR0J5SUlOd0Jybk83MnptSzA5UVNaLVNXSlJpbmJVU25UMFdmZAS1RZAnUzX1VoRWhZAbm55OUxKQ1V0Rm1ycVJBc25GM2tob3A0V3ZAB"
      }
    }
  }
}

const post_response = {
  message: 'Nov 8',
  id: '808626769002262_122108640597055026',
  updated_time: '2025-11-09T21:39:00+0000',
  from: { name: 'CraftKids Toys', id: '808626769002262' }
}

let lastReply = null
let lastPrivateReply = null

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  // Mock Facebook API - get comment tree with children
  if (url.pathname.startsWith('/122108640597055026_1178731644358181')
      && url.searchParams.get('fields')?.includes('comments')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(down_tree_response))

  // Mock Facebook API - get parent tree
  } else if (url.pathname.startsWith('/122108640597055026_1178731644358181')
      && url.searchParams.get('fields')?.includes('parent')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(up_tree_response))

  // Mock Facebook API - get post
  } else if (url.pathname.startsWith('/808626769002262_122108640597055026') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(post_response))

  // Mock Facebook API - post private reply via Messenger Send API
  } else if (url.pathname.includes('/messages') && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      const data = JSON.parse(body)
      lastPrivateReply = { message: data.message?.text, timestamp: Date.now() }
      console.log(`🔒 Private reply received: "${data.message?.text?.substring(0, 100)}${data.message?.text?.length > 100 ? '...' : ''}"`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ recipient_id: '10039794932789792', message_id: 'mock_message_id' }))
    })

  // Mock Facebook API - post reply to comment
  } else if (url.pathname.endsWith('/comments') && req.method === 'POST') {
    const message = url.searchParams.get('message')
    lastReply = { message, timestamp: Date.now() }
    console.log(`📝 Reply received: "${message?.substring(0, 100)}${message?.length > 100 ? '...' : ''}"`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id: '122108640597055026_mock_reply_id' }))

  // Run tests endpoint
  } else if (url.pathname === '/run_tests' && req.method === 'GET') {
    lastReply = null
    lastPrivateReply = null
    const webhook_req = http.request('http://facebook-comments:3210/', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (webhook_res) => {
      let data = ''
      webhook_res.on('data', chunk => data += chunk)
      webhook_res.on('end', () => {
        const webhookOk = webhook_res.statusCode === 200 && data === 'EVENT_RECEIVED'
        setTimeout(() => {
          const replyOk = lastReply && lastReply.message && lastReply.message.length > 0
          const privateReplyOk = lastPrivateReply && lastPrivateReply.message && lastPrivateReply.message.length > 0
          const success = webhookOk && replyOk && privateReplyOk
          console.log(`\n${'='.repeat(80)}\nTest ${success ? '💚 PASSED' : '🔴 FAILED'}:\n  Webhook:       ${webhookOk ? '✓' : '✗'} (${webhook_res.statusCode}, ${data})\n  Reply:         ${replyOk ? '✓' : '✗'} ${replyOk ? `(${lastReply.message.length} chars)` : '(no reply)'}\n  Private Reply: ${privateReplyOk ? '✓' : '✗'} ${privateReplyOk ? `(${lastPrivateReply.message.length} chars)` : '(no reply)'}\n${'='.repeat(80)}\n`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: success ? 'passed' : 'failed', webhook: webhookOk, reply: replyOk, privateReply: privateReplyOk }))
        }, 2000)
      })
    })
    webhook_req.on('error', (e) => console.error('Webhook request error:', e.message))
    webhook_req.end(JSON.stringify(webhook_payload))

  } else {
    res.writeHead(404)
    res.end()
  }
})

server.listen(3001, () => console.log('Facebook mock server running on port 3001'))

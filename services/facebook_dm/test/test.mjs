import http from 'http'

const webhook_payload = {
  page_id: '808626769002262',
  messaging: [{
    sender: { id: '10039794932789792' },
    recipient: { id: '808626769002262' },
    timestamp: 1762724342000,
    message: {
      mid: 'mid.test123',
      text: 'Hello, I need help with my order'
    }
  }]
}

const conversations_response = {
  data: [{
    id: 't_100012345',
    participants: {
      data: [
        { id: '808626769002262', name: 'CraftKids Toys' },
        { id: '10039794932789792', name: 'Roy Niederberg' }
      ]
    }
  }]
}

const BASE_URL='http://facebook-dm:3220'
const tests = [
  { name: 'webhook', method: 'POST', path: '/', body: JSON.stringify(webhook_payload), expect: { code: 200, text: 'EVENT_RECEIVED' }}
]

const run_test = (t) => new Promise((resolve) => {
  const { hostname, port, pathname, search } = new URL(BASE_URL + t.path)
  const headers = t.body ? { 'Content-Type': 'application/json' } : {}
  const req = http.request({ hostname, port, path: pathname + search, method: t.method, headers }, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      const pass = t.expect.code == res.statusCode && data == t.expect.text
      resolve({
        name: `${t.method} ${t.path}`, pass, code: res.statusCode, res: data.substring(0, 50)
      })
    })
  })
  req.on('error', () => resolve({ name: `${t.path}`, pass: false, err: 'Failed Connect' }))
  if (t.body) req.write(t.body)
  req.end()
})

const run_all_tests = async () => {
  console.log(`\n${'='.repeat(80)}\nRunning ${tests.length} tests...\n${'='.repeat(80)}`)
  const results = []
  for (const test of tests) {
    const result = await run_test(test)
    results.push(result)
    console.log(
        `${result.pass ? '💚 PASSED' : '🔴 FAILED'} ${result.name} (${result.code || result.err})`)
  }
  const passed = results.filter(r => r.pass).length
  console.log(`\n${'='.repeat(80)}\n${passed}/${tests.length} tests passed\n${'='.repeat(80)}\n`)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  // Mock Facebook API - get conversations
  if (url.pathname.startsWith('/808626769002262/conversations') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(conversations_response))
  }
})

server.listen(3003, () => {
  run_all_tests()
  console.log('Facebook dm test server running')
})

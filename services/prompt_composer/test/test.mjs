import http from 'http'

const BASE_URL = 'http://prompt-composer:4321'

const tests = [
  { name: 'GET /ask', method: 'GET', path: '/ask?query=test%20query', expect: 'This is the mock response' },
  { name: 'POST /ask (facebook)', method: 'POST', path: '/ask', body: JSON.stringify({ module: 'facebook_comments', chat_data: { post: { from: { name: 'TestPage' }, message: 'Test post', updated_time: '2025-01-01' }, chat_history: '- User: test' } }), expect: 'This is the mock response' },
  { name: 'POST /ask (admin)', method: 'POST', path: '/ask', body: JSON.stringify({ module: 'admin_ui', chat_data: { user_display_name: 'TestUser', chat_history: '- User: hello' } }), expect: 'This is the mock response' },
  { name: 'GET /knowledge-base', method: 'GET', path: '/knowledge-base', expect: 200 },
  { name: 'GET /prompt-instructions', method: 'GET', path: '/prompt-instructions', expect: 200 },
  { name: 'POST /instructions', method: 'POST', path: '/instructions', body: 'Updated instructions', expect: 200 },
  { name: 'POST /knowledge-base', method: 'POST', path: '/knowledge-base', body: 'Updated knowledge', expect: 200 },
  { name: 'POST /reload-instructions', method: 'POST', path: '/reload-instructions', expect: 200 },
  { name: 'POST /reload-knowledge-base', method: 'POST', path: '/reload-knowledge-base', expect: 200 },
]

const runTest = (test) => new Promise((resolve) => {
  const url = new URL(BASE_URL + test.path)
  const isJson = test.path === '/ask' && test.method === 'POST'
  const headers = test.body ? { 'Content-Type': isJson ? 'application/json' : 'text/plain' } : {}
  const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: test.method, headers }, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      const success = typeof test.expect === 'number' ? res.statusCode === test.expect : data.includes(test.expect)
      resolve({ name: test.name, success, status: res.statusCode, response: data.substring(0, 50) })
    })
  })
  req.on('error', () => resolve({ name: test.name, success: false, error: 'Connection failed' }))
  if (test.body) req.write(test.body)
  req.end()
})

const runAllTests = async () => {
  console.log(`\n${'='.repeat(80)}\nRunning ${tests.length} tests...\n${'='.repeat(80)}`)
  const results = []
  for (const test of tests) {
    const result = await runTest(test)
    results.push(result)
    console.log(`${result.success ? '💚' : '🔴'} ${result.name} - ${result.success ? 'PASSED' : 'FAILED'} (${result.status || result.error})`)
  }
  const passed = results.filter(r => r.success).length
  console.log(`\n${'='.repeat(80)}\n${passed}/${tests.length} tests passed\n${'='.repeat(80)}\n`)
}

runAllTests()

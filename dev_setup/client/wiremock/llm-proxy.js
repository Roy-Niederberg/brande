const http = require('http')

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'ollama'
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434')
const MODEL = process.env.MODEL || 'qwen2.5:1.5b'

http.createServer((req, res) => {
  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body)
      parsed.model = MODEL
      delete parsed.reasoning_effort
      const data = JSON.stringify(parsed)

      const proxyReq = http.request({
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, proxyRes => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      })

      proxyReq.on('error', err => {
        console.error('Proxy error:', err.message)
        res.writeHead(502)
        res.end(JSON.stringify({ error: 'LLM proxy error: ' + err.message }))
      })

      proxyReq.write(data)
      proxyReq.end()
    } catch (e) {
      console.error('Parse error:', e.message)
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Invalid request' }))
    }
  })
}).listen(80, () => console.log(`LLM proxy listening — forwarding to ${OLLAMA_HOST}:${OLLAMA_PORT} model=${MODEL}`))

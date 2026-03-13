import fs from 'fs'
import express from 'express'

const PROMPT_COMPOSER_URL = 'http://prompt-composer:4321'
const app = express()
app.set('trust proxy', true)
app.use(express.json())
app.r = (vrb, u, f) => app[vrb](u, async (rq, rs, nxt) => { try { await f(rq, rs, nxt) } catch (e) { nxt(e) } })

const emails = process.env.NODE_ENV === 'production'
  ? JSON.parse(fs.readFileSync('/run/secrets/authorized_emails', 'utf-8').trim()).emails
  : null
app.use((rq, rs, nx) => {
  if (!emails) return nx()
  if (!emails.includes(rq.headers['x-auth-email'])) return rs.sendStatus(403)
  nx()
})

app.get('/', (_, rs) => rs.redirect('/admin/chatQA'))

app.get('/chatQA', (_, rs) => rs.sendFile('/app/views/index.html'))
app.get('/loader.js', (_, rs) => rs.sendFile('/app/views/loader.js'))
app.get('/admin.js', (_, rs) => rs.sendFile('/app/views/admin.js'))
app.get('/widget.js', (_, rs) => rs.sendFile('/app/public/widget.js'))
app.use('/assets', express.static('/app/assets'))

app.get('/api/user', (rq, rs) =>
  rs.json({ email: rq.headers['x-auth-email'] || '', name: rq.headers['x-auth-name'] || '' }))

app.r('get', '/api/initial-content', async (_rq, rs) => {
  const [instructionsRes, knowledgeBaseRes, greetingRes] = await Promise.all([
    fetch(`${PROMPT_COMPOSER_URL}/system_prompts`),
    fetch(`${PROMPT_COMPOSER_URL}/knowledge_base`),
    fetch(`${PROMPT_COMPOSER_URL}/greeting`)
  ])
  rs.json({ instructions: await instructionsRes.text(), knowledgeBase: await knowledgeBaseRes.text(), greeting: await greetingRes.text() })
})

app.r('get', '/api/last_prompt', async (_, rs) => {
  const response = await fetch(`${PROMPT_COMPOSER_URL}/last_prompt`)
  rs.json(JSON.parse(await response.text()))
})

app.r('get', '/greeting', async (_, rs) => {
  const response = await fetch(`${PROMPT_COMPOSER_URL}/greeting`)
  rs.json(JSON.parse(await response.text()))
})

app.r('post', '/ask', async (rq, rs) => {
  console.log(`[${new Date().toISOString()}] Widget chat request from admin`)
  const { knowledgeBaseOverride, systemPromptOverride, ...requestBody } = rq.body
  if (knowledgeBaseOverride) requestBody.kb_override = knowledgeBaseOverride
  if (systemPromptOverride) requestBody.sp_override = systemPromptOverride
  const response = await fetch(`${PROMPT_COMPOSER_URL}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })
  rs.send(await response.text())
})

app.r('post', '/api/system_prompts', async (rq, rs) => {
  const { systemPrompts } = rq.body
  if (!systemPrompts) return rs.status(400).json({ error: 'System prompts required' })
  await fetch(`${PROMPT_COMPOSER_URL}/system_prompts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(systemPrompts)
  })
  rs.json({ success: true })
})

app.r('post', '/api/knowledge_base', async (rq, rs) => {
  const { knowledgeBase } = rq.body
  if (!knowledgeBase) return rs.status(400).json({ error: 'Knowledge base required' })
  await fetch(`${PROMPT_COMPOSER_URL}/knowledge_base`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(knowledgeBase)
  })
  rs.json({ success: true })
})

app.r('get', '/api/services', async (_, rs) => {
  const response = await fetch(`${PROMPT_COMPOSER_URL}/services`)
  rs.json(JSON.parse(await response.text()))
})

app.r('post', '/api/services', async (rq, rs) => {
  const { services } = rq.body
  if (!services) return rs.status(400).json({ error: 'Services required' })
  await fetch(`${PROMPT_COMPOSER_URL}/services`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(services)
  })
  rs.json({ success: true })
})

app.r('post', '/api/greeting', async (rq, rs) => {
  const { greeting } = rq.body
  if (!greeting) return rs.status(400).json({ error: 'Greeting required' })
  await fetch(`${PROMPT_COMPOSER_URL}/greeting`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(greeting)
  })
  rs.json({ success: true })
})

app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`); rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(9876, () => console.log('Server Start Up'))

import fs from 'fs'
import express from 'express'

// Copy shared UI to the ui volume (mounted by site service)
fs.cpSync('/app/views/index.html', '/app/ui/index.html')
fs.cpSync('/app/views/loader.js', '/app/ui/loader.js')
fs.cpSync('/app/views/page', '/app/ui/page', { recursive: true })

const PROMPT_COMPOSER_URL = 'http://prompt-composer:4321'
const app = express()
app.set('trust proxy', true)
app.use(express.json())
app.r = (vrb, u, f) => app[vrb](u, async (rq, rs, nxt) => { try { await f(rq, rs, nxt) } catch (e) { nxt(e) } })

const emails = JSON.parse(fs.readFileSync('/run/secrets/authorized_emails', 'utf-8').trim()).emails
const admin_secret = fs.readFileSync('/run/secrets/admin_secret', 'utf-8').trim()
app.use((rq, rs, nx) => {
  if (!emails) return nx()
  if (!emails.includes(rq.headers['x-auth-email'])) return rs.sendStatus(403)
  nx()
})

app.get(['/', '/chatQA'], (_, rs) => rs.sendFile('/app/views/index.html'))
app.get('/loader.js', (_, rs) => rs.sendFile('/app/views/loader.js'))
app.get('/admin.js', (_, rs) => rs.sendFile('/app/views/admin.js'))
app.use('/page', express.static('/app/views/page'))
app.use('/private', express.static('/app/private'))

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
  requestBody.kb_override = knowledgeBaseOverride
  requestBody.sp_override = systemPromptOverride
  const response = await fetch(`${PROMPT_COMPOSER_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': admin_secret },
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

app.r('get', '/api/services', (_, rs) => {
  const env = fs.readFileSync('/app/private/config.env', 'utf-8')
  const match = env.match(/^COMPOSE_PROFILES=(.*)$/m)
  const profiles = match ? match[1].split(',').filter(Boolean) : []
  rs.json({ profiles })
})

app.r('post', '/api/services', (rq, rs) => {
  const { profiles } = rq.body
  if (!Array.isArray(profiles)) return rs.status(400).json({ error: 'Profiles array required' })
  fs.writeFileSync('/app/private/config.env', `COMPOSE_PROFILES=${profiles.join(',')}\n`)
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
app.listen(4321, () => console.log('Server Start Up'))

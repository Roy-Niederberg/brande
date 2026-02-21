const fs = require('fs')
const express = require('express')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const PROMPT_COMPOSER_URL = 'http://prompt-composer:4321'

const app = express()
app.set('trust proxy', true)
app.use(express.json())

const { emails } = JSON.parse(fs.readFileSync(`/run/secrets/authorized_emails`, 'utf-8').trim())
emails.length > 0 || console.warn("No authorized user found.")
const google_strategy = JSON.parse(fs.readFileSync(`/run/secrets/google_strategy`, 'utf-8').trim())
const session_config = JSON.parse(fs.readFileSync(`/run/secrets/session_config`, 'utf-8').trim())
session_config.cookie.secure = process.env.NODE_ENV === 'production'
session_config.store = new FileStore({ path: './sessions', ttl: 1800, retries: 0 })

// Middleware
const isAuthorized = (rq, rs, nx) => rq.isAuthenticated() && emails.includes(rq.user.email) ? nx() : rs.redirect('/')
const checkSession = (rq, rs, nx) => rq.isAuthenticated() && emails.includes(rq.user.email) ? nx() : rs.sendStatus(401)

app.use(session(session_config))
app.use(passport.initialize())
app.use(passport.session())

// Passport config
passport.use(new GoogleStrategy(google_strategy, (_at, _rt, p, done) => done(null, { googleId: p.id, email: p.emails[0].value, displayName: p.displayName, picture: p.photos?.[0]?.value })))
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

// Public routes
app.get('/', (rq, rs) => rq.isAuthenticated() && emails.includes(rq.user.email) ? rs.redirect('/admin/chatQA') : rs.redirect('/admin/login/'))
app.get('/login/', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }))
app.get('/login/callback', passport.authenticate('google', { failureRedirect: '/admin/login/' }), (_, rs) => rs.redirect('/admin/chatQA'))
app.get('/logout', (rq, rs) => rq.logout(() => rq.session.destroy(() => rs.redirect('/'))))

// Protected routes - serve site HTML with admin.js injected
app.get('/chatQA', isAuthorized, async (_, rs) => {
  try {
    const html = await fetch('http://site:80/index.html').then(r => r.text())
    rs.send(html.replace('<script src="/loader.js">', '<script src="/admin/admin.js"></script>\n<script src="/loader.js">'))
  } catch (e) {
    console.error('Failed to load site HTML:', e.message)
    rs.status(500).send('Site unavailable')
  }
})
app.get('/admin.js', checkSession, (_, rs) => rs.sendFile('/app/views/admin.js'))

// API routes
app.get('/api/user', checkSession, (rq, rs) =>
  rs.json({ email: rq.user.email, name: rq.user.displayName, picture: rq.user.picture }))

app.get('/api/initial-content', checkSession, async (_rq, rs) => {
  try {
    const [instructionsRes, knowledgeBaseRes, greetingRes] = await Promise.all([
      fetch(`${PROMPT_COMPOSER_URL}/system_prompts`),
      fetch(`${PROMPT_COMPOSER_URL}/knowledge_base`),
      fetch(`${PROMPT_COMPOSER_URL}/greeting`)
    ])
    rs.json({ instructions: await instructionsRes.text(), knowledgeBase: await knowledgeBaseRes.text(), greeting: await greetingRes.text() })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching initial content:`, error.message)
    rs.json({ instructions: '', knowledgeBase: '', error: 'Could not fetch initial content from response-engine' })
  }
})

app.get('/api/last_prompt', checkSession, async (_, rs) => {
  try {
    const response = await fetch(`${PROMPT_COMPOSER_URL}/last_prompt`)
    rs.json(JSON.parse(await response.text()))
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Last prompt error:`, error.message)
    rs.sendStatus(500)
  }
})

app.get('/greeting', checkSession, async (_, rs) => {
  try {
    const response = await fetch(`${PROMPT_COMPOSER_URL}/greeting`)
    rs.json(JSON.parse(await response.text()))
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Greeting error:`, error.message)
    rs.sendStatus(500)
  }
})

app.post('/ask', checkSession, async (rq, rs) => {
  try {
    console.log(`[${new Date().toISOString()}] Widget chat request from admin`)

    const { knowledgeBaseOverride, systemPromptOverride, ...requestBody } = rq.body
    if (knowledgeBaseOverride)  requestBody.kb_override = knowledgeBaseOverride
    if (systemPromptOverride)  requestBody.sp_override = systemPromptOverride

    const response = await fetch(`${PROMPT_COMPOSER_URL}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    const responseText = await response.text()
    rs.send(responseText)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Widget API error:`, error.message)
    rs.status(500).send('ERROR: response server not available')
  }
})

app.post('/api/system_prompts', checkSession, async (rq, rs) => {
  try {
    const { systemPrompts } = rq.body
    if (!systemPrompts) return rs.status(400).json({ error: 'System prompts required' })
    await fetch(`${PROMPT_COMPOSER_URL}/system_prompts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(systemPrompts)
    })
    rs.json({ success: true })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update system prompts error:`, error.message)
    rs.status(500).json({ error: 'Failed to update system prompts' })
  }
})

app.post('/api/knowledge_base', checkSession, async (rq, rs) => {
  try {
    const { knowledgeBase } = rq.body
    if (!knowledgeBase) return rs.status(400).json({ error: 'Knowledge base required' })
    await fetch(`${PROMPT_COMPOSER_URL}/knowledge_base`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(knowledgeBase)
    })
    rs.json({ success: true })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update knowledge base error:`, error.message)
    rs.status(500).json({ error: 'Failed to update knowledge base' })
  }
})

app.post('/api/greeting', checkSession, async (rq, rs) => {
  try {
    const { greeting } = rq.body
    if (!greeting) return rs.status(400).json({ error: 'Greeting required' })
    await fetch(`${PROMPT_COMPOSER_URL}/greeting`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(greeting)
    })
    rs.json({ success: true })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update greeting error:`, error.message)
    rs.status(500).json({ error: 'Failed to update greeting' })
  }
})

// Error handling
app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(9876, ()=> console.log('Server Start Up'))

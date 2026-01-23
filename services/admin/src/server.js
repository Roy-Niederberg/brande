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
app.get('/login/', passport.authenticate('google', { scope: ['profile', 'email'] }))
app.get('/login/callback', passport.authenticate('google', { failureRedirect: '/admin/login/' }), (_, rs) => rs.redirect('/admin/chatQA'))

// Protected routes
app.get('/chatQA', isAuthorized, (_, rs) => rs.sendFile('/app/views/index.html'))
app.get('/style.css', isAuthorized, (_, rs) => rs.sendFile('/app/views/style.css'))
app.get('/script.js', isAuthorized, (_, rs) => rs.sendFile('/app/views/script.js'))

// API routes
app.get('/api/user', checkSession, (rq, rs) =>
  rs.json({ email: rq.user.email, name: rq.user.displayName, picture: rq.user.picture }))

app.get('/api/initial-content', checkSession, async (_rq, rs) => {
  try {
    const [instructionsRes, knowledgeBaseRes] = await Promise.all([
      fetch(`${PROMPT_COMPOSER_URL}/prompt-instructions`),
      fetch(`${PROMPT_COMPOSER_URL}/knowledge-base`)
    ])
    rs.json({ instructions: await instructionsRes.text(), knowledgeBase: await knowledgeBaseRes.text() })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching initial content:`, error.message)
    rs.json({ instructions: '', knowledgeBase: '', error: 'Could not fetch initial content from response-engine' })
  }
})

app.post('/ask', checkSession, async (rq, rs) => {
  try {
    console.log(`[${new Date().toISOString()}] Widget chat request from admin`)

    // Extract knowledge base override if provided
    const { knowledgeBaseOverride, ...restBody } = rq.body

    // Add KB override to chat_data if provided
    const requestBody = { ...restBody }
    if (knowledgeBaseOverride) {
      requestBody.chat_data = {
        ...requestBody.chat_data,
        knowledge_base_override: knowledgeBaseOverride
      }
      console.log(`[${new Date().toISOString()}] Using knowledge base override (${knowledgeBaseOverride.length} chars)`)
    }

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

app.post('/api/instructions', checkSession, async (rq, rs) => {
  try {
    const { instructions } = rq.body
    if (!instructions) return rs.status(400).json({ error: 'Instructions required' })
    await fetch(`${PROMPT_COMPOSER_URL}/instructions`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: instructions
    })
    rs.json({ success: true })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update instructions error:`, error.message)
    rs.status(500).json({ error: 'Failed to update instructions' })
  }
})

app.post('/api/knowledge-base', checkSession, async (rq, rs) => {
  try {
    const { knowledgeBase } = rq.body
    if (!knowledgeBase) return rs.status(400).json({ error: 'Knowledge base required' })
    await fetch(`${PROMPT_COMPOSER_URL}/knowledge-base`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: knowledgeBase
    })
    rs.json({ success: true })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update knowledge base error:`, error.message)
    rs.status(500).json({ error: 'Failed to update knowledge base' })
  }
})

// Error handling
app.use((_, rs) => rs.sendStatus(404))
app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500) })
app.listen(9876, ()=> console.log('Server Start Up'))

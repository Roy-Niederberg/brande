const fs = require('fs')
const express = require('express')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const axios = require('axios').create({ baseURL: 'http://prompt-composer:4321' })

const app = express()
app.set('trust proxy', true)
app.use(express.json())

const { emails }  = JSON.parse(fs.readFileSync(`/run/secrets/authorized_emails.json`, 'utf-8').trim())
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
app.get('/', (_, rs) => rs.sendFile('/app/public/landing.html'))
app.get('/login/', passport.authenticate('google', { scope: ['profile', 'email'] }))
app.get('/login/callback', passport.authenticate('google', { failureRedirect: '/' }), (_, rs) => rs.redirect('/chatQA'))

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
      axios.get('/prompt-instructions', { timeout: 10000 }),
      axios.get('/knowledge-base', { timeout: 10000 })
    ])
    rs.json({ instructions: instructionsRes.data, knowledgeBase: knowledgeBaseRes.data })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching initial content:`, error.message)
    rs.json({ instructions: '', knowledgeBase: '', error: 'Could not fetch initial content from response-engine' })
  }
})

app.post('/api/chat', checkSession, async (rq, rs) => {
  try {
    const { chatHistory } = rq.body
    if (!chatHistory || !Array.isArray(chatHistory)) return rs.status(400)
    const chat_meta_data = `# CHAT METADATA:\nadmin user interface. This chat is like a direct messaging app (WhatsApp, Telegram...). The chat is private and between you and a single customer. The customer name from his login is ${rq.user?.displayName}\n\n# CHAT:\n`
    const query = chatHistory.map(msg => `${msg.sender === 'user' ? '<<<USER>>>: ' : '<<<ASSISTANT>>>: '}${msg.text}`).join('\n')
    const complete_query = chat_meta_data + query + '\n\n'

    console.log(`[${new Date().toISOString()}] Customer chat request - messages: ${chatHistory.length}`)
    const response = await axios.get('/ask', { params: { query: complete_query }, timeout: 30000 })
    const responseText = typeof response.data === 'object' && response.data.response ? response.data.response : (typeof response.data === 'string' ? response.data : JSON.stringify(response.data))

    rs.json({ response: responseText, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Customer chat error:`, error.message)
    rs.json({ response: 'ERROR: response server not available', isError: true, timestamp: new Date().toISOString() })
  }
})

app.post('/api/instructions', checkSession, async (rq, rs) => {
  try {
    const { instructions } = rq.body
    if (!instructions) return rs.status(400).json({ error: 'Instructions required' })
    await axios.post('/instructions', instructions, { headers: { 'Content-Type': 'text/plain' }, timeout: 10000 })
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
    await axios.post('/knowledge-base', knowledgeBase, { headers: { 'Content-Type': 'text/plain' }, timeout: 10000 })
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

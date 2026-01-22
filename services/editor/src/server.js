const fs = require('fs')
const path = require('path')
const express = require('express')
const session = require('express-session')
const FileStore = require('session-file-store')(session)

const app = express()
app.set('trust proxy', true)
app.use(express.json({ limit: '10mb' }))

const { username, password } = JSON.parse(fs.readFileSync('/run/secrets/editor_credentials', 'utf-8').trim())
const { secret } = JSON.parse(fs.readFileSync('/run/secrets/session_secret', 'utf-8').trim())
if (!username || !password || !secret) throw new Error('Missing required secrets')

app.use(session({
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 1800000, httpOnly: true },
  store: new FileStore({ path: './sessions', ttl: 1800, retries: 0 })
}))

const viewsDir = process.env.NODE_ENV === 'development' ? path.join(__dirname, 'views') : '/app/views'
const isAuth = (rq, rs, nx) => rq.session.authenticated ? nx() : rs.redirect('/login')

app.get('/login', (_, rs) => rs.sendFile(path.join(viewsDir, 'login.html')))

app.post('/login', (rq, rs) => {
  const { username: u, password: p } = rq.body
  if (u === username && p === password) {
    rq.session.authenticated = true
    rs.json({ success: true })
  } else {
    rs.status(401).json({ error: 'Invalid credentials' })
  }
})

app.get('/editor', isAuth, (_, rs) => rs.sendFile(path.join(viewsDir, 'editor.html')))

app.get('/load', isAuth, (_, rs) => {
  try {
    const fullHtml = fs.readFileSync('/app/public/index.html', 'utf-8')
    const css = fs.readFileSync('/app/public/style.css', 'utf-8')
    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const bodyContent = bodyMatch ? bodyMatch[1] : fullHtml
    rs.json({ html: bodyContent, css })
  } catch (e) {
    rs.status(500).json({ error: e.message })
  }
})

app.post('/save', isAuth, (rq, rs) => {
  try {
    const { html, css } = rq.body
    if (!html) return rs.status(400).json({ error: 'HTML required' })
    fs.writeFileSync('/app/public/index-draft.html', html, 'utf-8')
    if (css) fs.writeFileSync('/app/public/style-draft.css', css, 'utf-8')
    rs.json({ success: true, message: 'Draft saved' })
  } catch (e) {
    rs.status(500).json({ error: e.message })
  }
})

app.listen(8080, () => console.log('Editor service started on port 8080'))

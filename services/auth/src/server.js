import crypto from 'crypto'
import fs from 'fs'
import express from 'express'

const app = express()
const SECRET = fs.readFileSync('/run/secrets/jwt_signing_key', 'utf-8').trim()
const { clientID, clientSecret } = JSON.parse(fs.readFileSync('/run/secrets/google_oauth', 'utf-8').trim())
const CALLBACK = process.env.OAUTH_CALLBACK || 'https://qabu.net/auth/callback'
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.qabu.net'
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false'
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'qabu.net').split(',')
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'

const sign = payload => {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

const verify = token => {
  const [h, p, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  if (sig !== expected) return null
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
  if (payload.exp < Date.now() / 1000) return null
  return payload
}

const validReturn = url => {
  try {
    const h = new URL(url).hostname
    return ALLOWED_HOSTS.some(a => h === a || h.endsWith('.' + a))
  } catch { return false }
}

app.get('/login', (rq, rs) => {
  const returnTo = rq.query.return_to && validReturn(rq.query.return_to) ? rq.query.return_to : 'https://qabu.net'
  const state = Buffer.from(JSON.stringify({ return_to: returnTo })).toString('base64url')
  const params = new URLSearchParams({
    client_id: clientID, redirect_uri: CALLBACK, response_type: 'code',
    scope: 'openid email profile', state, prompt: 'select_account'
  })
  rs.redirect(`${GOOGLE_AUTH}?${params}`)
})

app.get('/callback', async (rq, rs) => {
  try {
    const { code, state } = rq.query
    const { return_to } = JSON.parse(Buffer.from(state, 'base64url').toString())
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientID, client_secret: clientSecret,
        redirect_uri: CALLBACK, grant_type: 'authorization_code'
      })
    })
    const { id_token } = await tokenRes.json()
    const claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString())
    const jwt = sign({ email: claims.email, name: claims.name, picture: claims.picture, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })
    rs.cookie('qabu_token', jwt, { domain: COOKIE_DOMAIN, httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 86400000 })
    rs.redirect(validReturn(return_to) ? return_to : 'https://qabu.net')
  } catch (e) { console.error('OAuth callback error:', e.message); rs.status(500).send('Auth failed') }
})

app.get('/logout', (rq, rs) => {
  const returnTo = rq.query.return_to && validReturn(rq.query.return_to) ? rq.query.return_to : 'https://qabu.net'
  rs.cookie('qabu_token', '', { domain: COOKIE_DOMAIN, httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 0 })
  rs.redirect(returnTo)
})

app.get('/verify', (rq, rs) => {
  const cookie = rq.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('qabu_token='))
  const token = cookie?.split('=')[1]
  if (!token) return rs.sendStatus(401)
  const payload = verify(token)
  if (!payload) return rs.sendStatus(401)
  rs.set({ 'X-Auth-Email': payload.email, 'X-Auth-Name': payload.name || '' })
  rs.sendStatus(200)
})

app.listen(3456, () => console.log('Auth service started'))

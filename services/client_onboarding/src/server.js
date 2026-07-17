import express from 'express'
import { readFile } from 'fs/promises'
const app = express()

// Experiment phase: creation is invitation-only. Codes live in a bind-mounted
// file (never in git), one 9-char [A-Z0-9] code per line, added by hand.
// (Codes were single-use back when creation worked; in demo mode they're not
// consumed — restore consumption if creation ever comes back.)
const CODES_FILE = 'data/invite_codes.txt'
const CODE_RE = /^[A-Z0-9]{9}$/
const normCode = c => String(c ?? '').trim().toUpperCase()
const readCodes = async () => (await readFile(CODES_FILE, 'utf8').catch(() => ''))
  .split('\n').map(normCode).filter(l => CODE_RE.test(l))
const validInvite = async c => (await readCodes()).includes(normCode(c))

app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{await f(rq,rs,nxt)} catch(e) {nxt(e)}})

app.use(express.json())

// Subdomain rule: 5-20 chars, lowercase letters/digits/hyphens, start+end with letter.
const SUBDOMAIN_RE = /^[a-z][a-z0-9-]{3,18}[a-z]$/
app.r('get', '/', (_, rs) => rs.sendFile('views/index.html', {root: './src'}))
app.r('get', '/subdomain-regex', (_, rs) => rs.json({pattern: SUBDOMAIN_RE.source}))
app.r('post', '/validate-invite', async (rq, rs) => rs.json({valid: await validInvite(rq.body.code)}))

// A subdomain is taken iff its services-router answers /taken with 'true'.
// Anything else that responds (clients-router 404, or the wildcard-DNS
// landing-page catch-all) is not a client. Network errors bubble up to 500.
async function taken(s) {
  const resp = await fetch(`https://${s}.qabu.net/taken`, {signal: AbortSignal.timeout(5000)})
  return await resp.text() === 'true'
}

// Live availability check for the page (shown as the user types).
app.r('get', '/available/:sub', async (rq, rs) => {
  const s = rq.params.sub.toLowerCase()
  if (!SUBDOMAIN_RE.test(s)) return rs.sendStatus(400)
  rs.json({ available: !await taken(s) })
})

// DEMO MODE (since 2026-07-17): the scaffolding backend (provisioner +
// conductor) is retired — clients are created by hand. The full flow up to
// here still works (auth, invite, regex, availability); creation itself
// answers 503 and the page explains. Invite codes are NOT consumed.
// Caddy forward_auth already gates this route (Google sign-in); the header
// check is defense in depth for direct in-network access.
app.r('post', '/create-client', async (rq, rs) => {
  const { subdomain, invite } = rq.body
  if (!rq.headers['x-auth-email']) return rs.sendStatus(401)
  if (!await validInvite(invite)) return rs.sendStatus(403)

  const s = subdomain.toLowerCase()
  if (!SUBDOMAIN_RE.test(s)) return rs.sendStatus(400)
  if (await taken(s)) return rs.sendStatus(409)

  rs.sendStatus(503)
})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

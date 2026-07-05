import express from 'express'
import { readFile, writeFile } from 'fs/promises'
const app = express()
const secret = (await readFile('/run/secrets/provision_secret', 'utf8')).trim()

// Experiment phase: creation is invitation-only. Codes live in a bind-mounted
// file (never in git), one 9-char [A-Z0-9] code per line, added by hand.
// Single-use: a code is deleted from the file after a successful creation.
const CODES_FILE = 'data/invite_codes.txt'
const CODE_RE = /^[A-Z0-9]{9}$/
const normCode = c => String(c ?? '').trim().toUpperCase()
const readCodes = async () => (await readFile(CODES_FILE, 'utf8').catch(() => ''))
  .split('\n').map(normCode).filter(l => CODE_RE.test(l))
const validInvite = async c => (await readCodes()).includes(normCode(c))
const consumeInvite = async c => {
  const lines = (await readFile(CODES_FILE, 'utf8')).split('\n')
  await writeFile(CODES_FILE, lines.filter(l => normCode(l) !== normCode(c)).join('\n'))
}

app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{await f(rq,rs,nxt)} catch(e) {nxt(e)}})

app.use(express.json())

// Subdomain rule: 5-20 chars, lowercase letters/digits/hyphens, start+end with letter.
// MUST stay in sync with valid_sub() in services/conductor/src/main.cpp.
const SUBDOMAIN_RE = /^[a-z][a-z0-9-]{3,18}[a-z]$/
app.r('get', '/', (_, rs) => rs.sendFile('views/index.html', {root: './src'}))
app.r('get', '/subdomain-regex', (_, rs) => rs.json({pattern: SUBDOMAIN_RE.source}))
app.r('post', '/validate-invite', async (rq, rs) => rs.json({valid: await validInvite(rq.body.code)}))

async function scaffold(s, tier) {
  for (let i = 1; ; i++) {
    const host = `v${i}.qabu.net`

    const resp = await fetch(`https://${host}/scaffold`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'X-Provision-Secret': secret },
      body: JSON.stringify({ subdomain: s, tier })
    })

    // try v1, v2, v3 ... till non-existin server
    if (resp.headers.get('x-qabu') === 'not-found') return 

    // 507 means the server is running but doesn't have the resources. Other error, we stop
    if (resp.status !== 507) return 

    // found verver with sufficient resources - return it
    if (resp.ok) return host
  }
}

// Caddy forward_auth already gates this route (Google sign-in); the header
// check is defense in depth for direct in-network access.
app.r('post', '/create-client', async (rq, rs) => {
  const { subdomain, invite, tier = 1 } = rq.body
  if (!rq.headers['x-auth-email']) return rs.sendStatus(401)
  if (!await validInvite(invite)) return rs.sendStatus(403)

  const s = subdomain.toLowerCase()
  if (!SUBDOMAIN_RE.test(s)) return rs.sendStatus(400)
  if (+tier < 1) return rs.sendStatus(400)

  const resp = await fetch(`https://${s}.qabu.net/taken`, {signal: AbortSignal.timeout(5000)})
  const body = await resp.text()
  if (body === 'true') return rs.sendStatus(409)
  if (resp.headers.get('x-qabu') !== 'not-found') return rs.sendStatus(500)

  const vm = await scaffold(s, tier)
  if (!vm) return rs.sendStatus(507)

  // Client exists now — a consume failure must not fail the request, just log.
  await consumeInvite(invite).catch(e => console.error('invite consume failed:', e.message))

  // we should wait and check if the client is up and running and only then return it.
  rs.json({ subdomain: s, vm })
})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

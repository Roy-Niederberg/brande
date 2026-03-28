import express from 'express'
import { readFile } from 'fs/promises'
const app = express()
const secret = (await readFile('/run/secrets/provision_secret', 'utf8')).trim()
const emails = JSON.parse(await readFile('/run/secrets/onboarding_emails', 'utf8')).emails

app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{await f(rq,rs,nxt)} catch(e) {nxt(e)}})

app.use((rq, rs, nx) => {
  if (!emails.includes(rq.headers['x-auth-email'])) return rs.sendStatus(403)
  nx()
})
app.use(express.json())

const SUBDOMAIN_RE = /^[a-z][a-z0-9-]{3,18}[a-z]$/
app.r('get', '/', (_, rs) => rs.sendFile('views/index.html', {root: './src'}))
app.r('get', '/subdomain-regex', (_, rs) => rs.json({pattern: SUBDOMAIN_RE.source}))

async function scaffold(s, tier) {
  for (let i = 1; ; i++) {
    const host = `v${i}.qabu.net`
    const resp = await fetch(`https://${host}/scaffold`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'X-Provision-Secret': secret },
      body: JSON.stringify({ subdomain: s, tier })
    })
    if (resp.headers.get('x-qabu') === 'not-found') return
    if (resp.ok) return host
    if (resp.status !== 507) return
  }
}

app.r('post', '/create-client', async (rq, rs) => {
  const { subdomain, tier = 1 } = rq.body

  const s = subdomain.toLowerCase()
  if (!SUBDOMAIN_RE.test(s)) return rs.sendStatus(400)
  if (+tier < 1) return rs.sendStatus(400)

  const resp = await fetch(`https://${s}.qabu.net/taken`, {signal: AbortSignal.timeout(5000)})
  const body = await resp.text()
  if (body === 'true') return rs.sendStatus(409)
  if (resp.headers.get('x-qabu') !== 'not-found') return rs.sendStatus(500)

  const vm = await scaffold(s, tier)
  if (!vm) return rs.sendStatus(507)
  rs.json({ subdomain: s, vm })
})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

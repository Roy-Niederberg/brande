import express from 'express'
import { readFile } from 'fs/promises'
import net from 'net'

const app = express()
app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{await f(rq,rs,nxt)}catch(e){nxt(e)}})
app.use(express.json())

const secret = (await readFile('/run/secrets/provision_secret', 'utf8')).trim()

function callConductor(subdomain, tier) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection('/run/qabu/conductor.sock')
    let buf = ''
    sock.on('connect', () => sock.write(`${subdomain} ${tier}\n`))
    sock.on('data',    chunk => buf += chunk)
    sock.on('end',     () => {
      const line = buf.trim()
      if (line === 'ok') resolve()
      else reject(Object.assign(new Error(line), { status: parseInt(line.split(' ')[1]) || 500 }))
    })
    sock.on('error', reject)
  })
}

app.r('post', '/scaffold', async (rq, rs) => {
  if (rq.headers['x-provision-secret'] !== secret) return rs.sendStatus(403)
  const { subdomain, tier } = rq.body
  if (!subdomain || !tier) return rs.sendStatus(400)
  try {
    await callConductor(subdomain, +tier)
    rs.json({ created: subdomain })
  } catch (e) {
    rs.sendStatus(e.status || 500)
  }
})

app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.message}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, () => console.log('Provisioner started'))

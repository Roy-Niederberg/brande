import crypto from 'crypto'
import fs from 'fs'
import express from 'express'

const app = express()
const SECRET = fs.readFileSync('/run/secrets/jwt_signing_key', 'utf-8').trim()

const verify = token => {
  const [h, p, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  if (sig !== expected) return null
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
  if (payload.exp < Date.now() / 1000) return null
  return payload
}

app.get('/', (rq, rs) => {
  const cookie = rq.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('qabu_token='))
  const token = cookie?.split('=')[1]
  if (!token) return rs.sendStatus(401)
  const payload = verify(token)
  if (!payload) return rs.sendStatus(401)
  rs.set({ 'X-Auth-Email': payload.email, 'X-Auth-Name': encodeURIComponent(payload.name || '') })
  rs.sendStatus(200)
})

app.listen(3456, () => console.log('Auth verifier started'))

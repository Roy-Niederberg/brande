// Mimics the conductor's create_client logic over a Unix socket.
// Used only in provisioner tests.
import net from 'net'
import { mkdirSync, unlinkSync } from 'fs'

const SOCK = '/run/qabu/conductor.sock'
const MAX_TIER = 5

mkdirSync('/run/qabu', { recursive: true })
try { unlinkSync(SOCK) } catch {}

const clients = new Map() // subdomain -> tier

net.createServer(sock => {
  let buf = ''
  sock.on('data', d => buf += d)
  sock.on('end', () => {
    const [sub, t] = buf.trim().split(' ')
    const tier = +t || 1
    if (clients.has(sub)) return sock.end('err 409\n')
    const used = [...clients.values()].reduce((a, b) => a + b, 0)
    if (used + tier > MAX_TIER) return sock.end('err 507\n')
    clients.set(sub, tier)
    sock.end('ok\n')
  })
}).listen(SOCK, () => console.log('mock conductor ready'))

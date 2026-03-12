import fs from 'fs'
import { join, extname, resolve } from 'path'
import express from 'express'
import Busboy from 'busboy'

const app = express(), DATA = './data'
const IMGS = { backgroundImage: 'background', profilePic: 'profile-pic', postImage: 'post-image' }
const LANGS = {
  en: { dir: 'ltr', font: 'Inter', fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', locale: 'en_US' },
  he: { dir: 'rtl', font: 'Rubik', fontUrl: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap', locale: 'he_IL' }
}

const onbEmails = process.env.NODE_ENV === 'production'
  ? JSON.parse(fs.readFileSync('/run/secrets/onboarding_emails', 'utf-8').trim()).emails
  : null

fs.mkdirSync(DATA, { recursive: true })
if (onbEmails) app.use((rq, rs, nx) => onbEmails.includes(rq.headers['x-auth-email']) ? nx() : rs.sendStatus(403))
app.use(express.static('public'))

app.get('/api/configs', (req, res) => {
  const configs = fs.readdirSync(DATA)
    .filter(d => fs.existsSync(join(DATA, d, 'config.json')))
    .map(d => JSON.parse(fs.readFileSync(join(DATA, d, 'config.json'), 'utf-8')))
  res.json(configs)
})

app.get('/api/configs/:sub', (req, res) => {
  const p = join(DATA, req.params.sub, 'config.json')
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' })
  res.sendFile(resolve(p))
})

app.get('/api/configs/:sub/:file', (req, res) => {
  const p = join(DATA, req.params.sub, req.params.file)
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' })
  res.sendFile(resolve(p))
})

app.post('/api/configs', (req, res) => {
  const bb = Busboy({ headers: req.headers }), fields = {}, files = []
  bb.on('field', (k, v) => { fields[k] = v })
  bb.on('file', (name, stream, { filename }) => {
    const chunks = []
    stream.on('data', c => chunks.push(c))
    stream.on('end', () => { if (chunks.length) files.push({ name, filename, data: Buffer.concat(chunks) }) })
  })
  bb.on('close', () => { try {
    const sub = fields.subdomain
    if (!sub || !/^[a-z0-9]+$/.test(sub)) return res.status(400).json({ error: 'invalid subdomain' })
    const lang = LANGS[fields.lang] || LANGS.en
    const dir = join(DATA, sub)
    fs.mkdirSync(dir, { recursive: true })

    const saved = {}
    for (const f of files) {
      const fname = (IMGS[f.name] || f.name) + extname(f.filename)
      fs.writeFileSync(join(dir, fname), f.data)
      saved[f.name] = fname
    }

    const cfgPath = join(dir, 'config.json')
    const prev = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) : {}
    const config = {
      subdomain: sub, displayName: fields.displayName || '',
      lang: fields.lang || 'en', direction: lang.dir,
      font: { family: lang.font, url: lang.fontUrl },
      socialLinks: { facebook: fields['social.facebook'] || '', instagram: fields['social.instagram'] || '', youtube: fields['social.youtube'] || '' },
      ogMeta: { title: fields['og.title'] || '', description: fields['og.description'] || '', locale: lang.locale },
      greeting: JSON.parse(fields.greeting || '[]'),
      mockFacebook: { pageName: fields['mock.pageName'] || '', pageCategory: fields['mock.pageCategory'] || '', postText: fields['mock.postText'] || '' },
      backgroundImage: saved.backgroundImage || prev.backgroundImage || '',
      profilePic: saved.profilePic || prev.profilePic || '',
      postImage: saved.postImage || prev.postImage || '',
      createdAt: prev.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2))
    res.json(config)
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }) } })
  req.pipe(bb)
})

app.listen(8559, () => console.log('Client Onboarding Service Started'))

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

const REGISTRY = 'registry.gitlab.com/rny3/brande'

app.post('/api/scaffold/:sub', express.json(), (req, res) => {
  const sub = req.params.sub
  const cfgPath = join(DATA, sub, 'config.json')
  if (!fs.existsSync(cfgPath)) return res.status(404).json({ error: 'config not found — create via onboarding first' })

  const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
  const base = join(DATA, sub)
  const lang = LANGS[config.lang] || LANGS.en

  // gateway/Caddyfile — minimal: admin + prompt-composer only
  fs.mkdirSync(join(base, 'gateway'), { recursive: true })
  fs.writeFileSync(join(base, 'gateway', 'Caddyfile'), `:80 {
\thandle_path /admin/* {
\t\treverse_proxy admin:9876 {
\t\t\theader_up X-Forwarded-Proto {header.X-Forwarded-Proto}
\t\t}
\t}

\thandle /site/* {
\t\turi strip_prefix /site
\t\treverse_proxy prompt-composer:4321
\t}
}
`)

  // assets/
  fs.mkdirSync(join(base, 'assets', 'mock_facebook'), { recursive: true })
  const clientConfig = {
    lang: config.lang, direction: lang.dir, title: config.displayName,
    backgroundImage: config.backgroundImage || 'background.png',
    font: { family: lang.font, url: lang.fontUrl },
    widget: { fontFamily: `'${lang.font}', sans-serif`, googleFontsUrl: lang.fontUrl }
  }
  if (config.socialLinks) {
    const links = []
    for (const [icon, url] of Object.entries(config.socialLinks)) {
      if (url) links.push({ icon, url })
    }
    if (links.length) clientConfig.socialLinks = links
  }
  if (config.displayName) clientConfig.overlayTitle = config.displayName
  fs.writeFileSync(join(base, 'assets', 'client-config.json'), JSON.stringify(clientConfig, null, 2))

  // Copy background image if it exists in onboarding data
  const bgSrc = join(base, config.backgroundImage || 'background.png')
  const bgDst = join(base, 'assets', config.backgroundImage || 'background.png')
  if (fs.existsSync(bgSrc) && bgSrc !== bgDst) fs.copyFileSync(bgSrc, bgDst)

  // data/
  fs.mkdirSync(join(base, 'data'), { recursive: true })
  fs.writeFileSync(join(base, 'data', 'knowledge_base.json'), '[]')
  fs.writeFileSync(join(base, 'data', 'capabilities.js'), 'export default {}\n')
  fs.writeFileSync(join(base, 'data', 'services.json'), JSON.stringify({
    site: false, 'facebook-comments': false, 'facebook-dm': false, 'mock-facebook': false
  }, null, 2))

  const greeting = { widget: { messages: (config.greeting || []).map(g => ({ delay: g.delay || 1000, text: g.text || '' })) } }
  fs.writeFileSync(join(base, 'data', 'greeting.json'), JSON.stringify(greeting, null, 2))

  const spTemplate = {
    widget: { gatekeeper: '', main: '', capabilities: '' },
    facebook_comments: { gatekeeper: '', main: '' }
  }
  fs.writeFileSync(join(base, 'data', 'system_prompts.json'), JSON.stringify(spTemplate, null, 2))

  // secrets/
  fs.mkdirSync(join(base, 'secrets'), { recursive: true })
  const emails = config.authorizedEmails || [req.headers['x-auth-email']].filter(Boolean)
  fs.writeFileSync(join(base, 'secrets', 'authorized_emails.json'), JSON.stringify({ emails }, null, 2))

  // docker-compose.yml — minimal stack
  fs.writeFileSync(join(base, 'docker-compose.yml'), `services:

  gateway:
    image: caddy:2.10.2-alpine
    networks: [client_network, qabu_network]
    volumes: [./gateway/Caddyfile:/etc/caddy/Caddyfile:ro]

  prompt-composer:
    image: ${REGISTRY}/prompt_composer:latest
    networks: [client_network]
    secrets: [gemini_1, gemini_2, groq_1, groq_2]
    volumes: [./data/:/app/data]

  admin:
    image: ${REGISTRY}/admin:latest
    networks: [client_network]
    secrets: [authorized_emails]
    volumes:
      - ./assets:/app/assets:ro
      - ../shared/widget/widget.js:/app/public/widget.js:ro

networks:
  client_network:
  qabu_network: {external: true}

secrets:
  authorized_emails: {file: ./secrets/authorized_emails.json}
  gemini_1:          {file: ./secrets/gemini_1.secret}
  gemini_2:          {file: ./secrets/gemini_2.secret}
  groq_1:            {file: ./secrets/groq_1.secret}
  groq_2:            {file: ./secrets/groq_2.secret}
`)

  res.json({ scaffolded: sub, path: base })
})

app.listen(8559, () => console.log('Client Onboarding Service Started'))

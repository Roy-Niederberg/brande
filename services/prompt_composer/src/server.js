import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { Groq } from 'groq-sdk'
import { GoogleGenAI } from '@google/genai'

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use('/ask', rateLimit({ windowMs: 20000, max: 5, message: 'Try again later' }))
app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{await f(rq,rs,nxt)} catch(e) {nxt(e)}})
const writeFile = (f, d) => fs.writeFileSync(`./data/${f}`, d, 'utf-8')
const writeJSON = (f, d) => writeFile(f, JSON.stringify(d))
const toJS = (v,d=0) => typeof v==='string' ? '`'+v.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${')+'`' : '{\n'+Object.entries(v).map(([k,w])=>`${'  '.repeat(d+1)}${k}: ${toJS(w,d+1)}`).join(',\n')+'\n'+'  '.repeat(d)+'}'
const writeJSObj = (f, d) => writeFile(f, `export default ${toJS(d)}\n`)
const logLine = e => JSON.stringify({ts: new Date().toISOString(), ...e}) + '\n'
const logEvent = (e, file = 'events') => fs.appendFileSync(`./logs/${file}.jsonl`, logLine(e))

// =============== Server Loading section =======================================================//
const GEM_1 = fs.readFileSync('/run/secrets/gemini_1', 'utf-8').trim()
const GEM_2 = fs.readFileSync('/run/secrets/gemini_2', 'utf-8').trim()
const GEM_3 = fs.readFileSync('/run/secrets/gemini_3', 'utf-8').trim()
const GEM_4 = fs.readFileSync('/run/secrets/gemini_4', 'utf-8').trim()
const GRK_1 = fs.readFileSync('/run/secrets/groq_1'  , 'utf-8').trim()
const GRK_2 = fs.readFileSync('/run/secrets/groq_2'  , 'utf-8').trim()
const GRK_3 = fs.readFileSync('/run/secrets/groq_3'  , 'utf-8').trim()
const GRK_4 = fs.readFileSync('/run/secrets/groq_4'  , 'utf-8').trim()
const ADMIN_SECRET = fs.readFileSync('/run/secrets/admin_secret', 'utf-8').trim()

const gk1 = [new Groq({apiKey:GRK_1}),'openai/gpt-oss-120b']
const gk2 = [new Groq({apiKey:GRK_2}),'openai/gpt-oss-120b']
const gk3 = [new Groq({apiKey:GRK_3}),'openai/gpt-oss-120b']
const gk4 = [new Groq({apiKey:GRK_4}),'openai/gpt-oss-120b']
const groq = [[...gk1, ...gk2],[...gk3,...gk4]]
const m1f = [new GoogleGenAI({apiKey:GEM_3}),'gemini-3.5-flash']
const m2f = [new GoogleGenAI({apiKey:GEM_4}),'gemini-3.5-flash']
const m1  = [new GoogleGenAI({apiKey:GEM_1}),'gemini-3.1-flash-lite']
const m2  = [new GoogleGenAI({apiKey:GEM_2}),'gemini-3.1-flash-lite']
const gemini = [[...m1f, ...m1], [...m2f, ...m2]]

const askGroq = async (content, msgs, errors) => {
  const llm = groq[0]
  groq.push(groq.shift())
  for (const i of [0,2]) { // with retry
    const ask_obj = {model: llm[i + 1], messages: [{role: 'system', content}, ...msgs]}
    try {
      const res = (await llm[i].chat.completions.create(ask_obj)).choices[0].message.content
      fs.writeFileSync('./logs/last_prompt.json', JSON.stringify({...ask_obj, res}))
      return {res, model: llm[i + 1]}
    } catch (e) {
      errors.push(`${llm[i + 1]} try ${i}: ${e.message}`)
      console.error(`🚩 failed [${llm[i + 1]}] try ${i}:`, e.message)
    }
  }
}

// Free-tier Gemini can be slow-but-alive under load (observed 90-119s); abort → next try/model.
const GEMINI_TIMEOUT_MS = +process.env.GEMINI_TIMEOUT_MS || 12000

const askGemini = async (system, msgs, errors) => {
  const llm = gemini[0]
  gemini.push(gemini.shift())
  const contents = msgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.content}]
  }))
  for (const i of [0,2]) { // with retry
    const conf = {thinkingConfig: {thinkingLevel: "MEDIUM"}, systemInstruction: system}
    const ask_obj = {model: llm[i + 1], config: conf , contents}
    try {
      const config = {...conf, abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)}
      const res = (await llm[i].models.generateContent({...ask_obj, config})).text
      fs.writeFileSync('./logs/last_prompt.json', JSON.stringify({...ask_obj, res}))
      return {res, model: llm[i + 1]}
    } catch (e) {
      const msg = e.name === 'AbortError' ? `timed out after ${GEMINI_TIMEOUT_MS}ms` : e.message
      errors.push(`${llm[i + 1]} try ${i}: ${msg}`)
      console.error(`🚩 failed [${llm[i + 1]}] try ${i}:`, msg)
    }
  }
}

const parse = (template, local_time) =>  {
const data = { date: local_time || new Date().toString('en-IL', { timeZone: 'Asia/Jerusalem' }) }
  return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const value = key.trim().split('.').reduce((obj, i) => obj?.[i], data);
    return value !== undefined ? value : match;
  });
}

// =============== Endpoints ====================================================================//
// Config writes always require the admin secret; reads are gated too, except
// greeting + capabilities, which the widget fetches straight from the visitor's
// browser. Without this, /{endpoint} on port 4321 is world-writable via the
// services-router's generic proxy (POST capabilities.js = stored XSS).
const authed = h => h['x-admin-secret'] === ADMIN_SECRET
const PUBLIC_GET = new Set(['greeting', 'capabilities'])
const files = ['knowledge_base.json', 'system_prompts.js', 'greeting.json', 'capabilities.js']
const $ = {}
for (const f of files) {
  const [name, ext] = f.split('.')
  let arg = (ext === 'json') ? {with:{type:'json'}} : {}
  let write = ext === 'json' ? writeJSON : f === 'system_prompts.js' ? writeJSObj : writeFile
  $[name] = (await import(`../data/${f}`, arg)).default
  app.r('get', '/' + name, ({headers}, rs) => {
    if (!PUBLIC_GET.has(name) && !authed(headers)) return rs.sendStatus(401)
    f === 'system_prompts.js' ? rs.json($[name]) : rs.sendFile(`data/${f}`, {root: '.'})
  })
  app.r('post', '/' + name, ({body, headers}, rs) => {
    if (!authed(headers)) return rs.sendStatus(401)
    $[name] = body; write(f, body); rs.sendStatus(200)
  })
}

app.r('post', '/ask', async ({ body, headers }, rs) => {
  const t0 = Date.now()
  /** @type {{v: number, channel?: string, conversation_id?: string, user_mssg?: string,
      errors: string[], gk?: string, skip_gk?: boolean, main?: string, res?: string,
      ignore?: boolean, error?: boolean, admin?: boolean, duration_ms?: number,
      gk_ms?: number, main_ms?: number}} */
  const ev = {
    v: 1,
    channel: body.mod,
    conversation_id: body.conversation_id,
    user_mssg: body.chat?.at(-1)?.content,
    errors: []
  }
  await ask(body, headers, ev)
  ev.duration_ms = Date.now() - t0
  logEvent(ev, 'events')
  ev.error ? rs.sendStatus(500) : ev.ignore ? rs.sendStatus(204) : rs.send(ev.res)
})

async function ask(body, headers, ev) {
  try {
    ev.admin = authed(headers)

    if (!body.mod || !$.system_prompts[body.mod] || !body.chat?.length)
      throw `ASK validation [${body.mod}][${$.system_prompts[body.mod]}][${body.chat?.length}]`

    const sp = {...$.system_prompts[body.mod], ...(ev.admin && body.sp_override)}
    const kb_obj = (ev.admin && body.kb_override) || $.knowledge_base

    if (body.skip_gk) {
      ev.skip_gk = true
    } else {
      const t = Date.now()
      const gk = await askGroq(parse(sp.gatekeeper, body.local_time), body.chat, ev.errors)
      ev.gk_ms = Date.now() - t
      if (gk === undefined) ev.errors.push('gatekeeper exhausted all keys')
      else {
        ev.gk = gk.model
        if (gk.res === 'IGNORE') { ev.ignore = true; return }
        if (gk.res !== 'ESCALATE') {
          ev.res = gk.res
          return
        }
      }
    }

    const kb = '# KNOWLEDGE BASE:\n' +
      kb_obj.map(e => `## ${e.key}\n${e.content}`).join('\n\n')

    let caps = ''
    if (sp.capabilities && Object.keys($.capabilities).length) {
      const list = Object.entries($.capabilities)
      .map(([k, v]) => `- ${k}: ${v.description}`).join('\n')
      caps = sp.capabilities + '\n\n# CAPABILITIES:\n' + list
    }

    const query = [sp.main, caps, kb].join('\n\n')

    const t = Date.now()
    for (const i of [1,2]) { // 2 tries — each rotates to a fresh bucket
      const ans = await askGemini(query, body.chat, ev.errors)
      if (ans) {
        ev.main = ans.model
        ev.main_ms = Date.now() - t
        ev.res = ans.res
        return
      }
      ev.errors.push(`Gemini try ${i} failed.`)
    }
    throw('main model exhausted all retries')
  } catch (e) {
    ev.errors.push(String(e.message ?? e))
    ev.error = true
  }
}

app.r('get', '/last_prompt', ({headers}, rs) => {
  if (!authed(headers)) return rs.sendStatus(401)
  rs.sendFile('logs/last_prompt.json', {root: '.'})
})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

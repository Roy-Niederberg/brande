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
const logChat = (id, e) => /^[\w.-]{1,128}$/.test(id ?? '') &&
  fs.appendFileSync(`./logs/conversations/${id}.jsonl`, logLine(e))
fs.mkdirSync('./logs/conversations', {recursive: true})
const CHAT_RETENTION_MS = 30 * 864e5
const sweepChats = () => fs.readdirSync('./logs/conversations').forEach(f =>
  Date.now() - fs.statSync(`./logs/conversations/${f}`).mtimeMs > CHAT_RETENTION_MS
    && fs.unlinkSync(`./logs/conversations/${f}`))
sweepChats(); setInterval(sweepChats, 864e5)

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

const askGroq = async (content, msgs) => {
  const llm = groq[0]
  groq.push(groq.shift())
  for (const i of [0,2]) { // with retry
    const ask_obj = {model: llm[i + 1], messages: [{role: 'system', content}, ...msgs]}
    try {
      const res = (await llm[i].chat.completions.create(ask_obj)).choices[0].message.content
      fs.writeFileSync('./logs/last_prompt.json', JSON.stringify({...ask_obj, res}))
      return {res, model: llm[i + 1]}
    } catch (e) {console.error(`🚩 failed [${llm[i + 1]}] try ${i}:`, e.message)}
  }
}

const askGemini = async (system, msgs) => {
  const llm = gemini[0]
  gemini.push(gemini.shift())
  const contents = msgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.content}]
  }))
  for (const i of [0,2]) { // with retry
    const conf = {thinkingConfig: {thinkingLevel: "MEDIUM"}, systemInstruction: system}
    const ask_obj = {model: llm[i + 1], config: conf , contents}
    try {
      const res = (await llm[i].models.generateContent(ask_obj)).text
      fs.writeFileSync('./logs/last_prompt.json', JSON.stringify({...ask_obj, res}))
      return {res, model: llm[i + 1]}
    } catch (e) {console.error(`🚩 failed [${llm[i + 1]}] try ${i}:`, e.message)}
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
const files = ['knowledge_base.json', 'system_prompts.js', 'greeting.json', 'capabilities.js']
const $ = {}
for (const f of files) {
  const [name, ext] = f.split('.')
  let arg = (ext === 'json') ? {with:{type:'json'}} : {}
  let write = ext === 'json' ? writeJSON : f === 'system_prompts.js' ? writeJSObj : writeFile
  $[name] = (await import(`../data/${f}`, arg)).default
  app.r('get', '/' + name, (_, rs) => f === 'system_prompts.js' ? rs.json($[name]) : rs.sendFile(`data/${f}`, {root: '.'}))
  app.r('post', '/' + name, ({body}, rs) => {$[name] = body; write(f, body); rs.sendStatus(200)})
}

app.r('post', '/ask', async ({ body, headers }, rs) => {
  if (!body.mod || !$.system_prompts[body.mod] || !body.chat?.length)
    throw `ASK validation [${body.mod}][${$.system_prompts[body.mod]}][${body.chat?.length}]`

  const trusted = headers['x-admin-secret'] === ADMIN_SECRET

  const record = (outcome, model, reply) => {
    logEvent({channel: body.mod, model, outcome, conversation_id: body.conversation_id},
      trusted ? 'admin_events' : 'events')
    if (trusted) return // draft-override test chats don't belong in customer transcripts
    logChat(body.conversation_id,
      {channel: body.mod, user: body.chat.at(-1).content, reply, model, outcome})
  }

  const sp = trusted ? body.sp_override : $.system_prompts[body.mod]
  const kb_obj = (trusted && body.kb_override) || $.knowledge_base

  let escalate = body.skip_gk

  if (!escalate) {
    const gk = await askGroq(parse(sp.gatekeeper, body.local_time), body.chat)
    if (gk === undefined) console.error('🚩 gatekeeper exhausted all keys')
    else if (gk.res === 'IGNORE')   {record('ignore', gk.model); return rs.send("...")}
    else if (gk.res !== 'ESCALATE') {
      record('gatekeeper', gk.model, gk.res)
      return rs.send(gk.res)
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

  for (const i of [1,2]) { // 2 tries — each rotates to a fresh bucket
    const ans = await askGemini(query, body.chat)
    if (ans) {
      record('main', ans.model, ans.res)
      return rs.send(ans.res)
    }
    console.log(`Gemini try ${i} failed.`)
  }
  console.error('🚩 main model exhausted all retries')

  const unavailable = "The assistant is unavailable at the moment. Please try again later."
  record('unavailable', undefined, unavailable)
  rs.send(unavailable)
})

app.r('get', '/last_prompt', (_, rs) => {rs.sendFile('logs/last_prompt.json', {root: '.'})})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

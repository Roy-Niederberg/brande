import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import OpenAI from 'openai'

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use('/ask', rateLimit({ windowMs: 20000, max: 5, message: 'Try again later' }))
app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{await f(rq,rs,nxt)} catch(e) {nxt(e)}})
const writeFile = (f, d) => fs.writeFileSync(`./data/${f}`, d, 'utf-8')
const writeJSON = (f, d) => writeFile(f, JSON.stringify(d))

// =============== Server Loading section =======================================================//
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/'
const GROQ = 'https://api.groq.com/openai/v1'
const GEM_1 = fs.readFileSync('/run/secrets/gemini_1', 'utf-8').trim()
const GEM_2 = fs.readFileSync('/run/secrets/gemini_2', 'utf-8').trim()
const GRK_1 = fs.readFileSync('/run/secrets/groq_1'  , 'utf-8').trim()
const GRK_2 = fs.readFileSync('/run/secrets/groq_2'  , 'utf-8').trim()

const gk = [new OpenAI({apiKey:GRK_2,baseURL:GROQ}),'openai/gpt-oss-120b']
const m1 = [new OpenAI({apiKey:GEM_2,baseURL:GEMINI}),'gemini-2.5-flash']
const m2 = [new OpenAI({apiKey:GEM_1,baseURL:GEMINI}),'gemini-2.5-flash-lite']
const m3 = [new OpenAI({apiKey:GRK_1,baseURL:GROQ}),'openai/gpt-oss-120b']

const ask = async (llm, content, msgs, re='low') => {
  const ask_obj = {
    model: llm[1],
    messages: [{ role: 'system', content }, ...msgs],
    reasoning_effort: re,
  }
  const r = await llm[0].chat.completions.create(ask_obj)
  const response = r.choices[0]?.message?.content || ''
  writeJSON('last_prompt.json', { ...ask_obj, response })
  console.log(response)
  return response
}

// =============== Endpoints ====================================================================//
const files = ['knowledge_base.json', 'system_prompts.json', 'greeting.json', 'capabilities.js']
const $ = {}
for (const f of files) {
  const [name, ext] = f.split('.')
  let arg = (ext === 'json') ? {with:{type:'json'}} : {}
  let write = (ext === 'json') ? writeJSON : writeFile
  $[name] = (await import(`../data/${f}`, arg)).default
  app.r('get', '/' + name, (_, rs) => {rs.sendFile(`data/${f}`, {root: '.'})})
  app.r('post', '/' + name, ({body}, rs) => {$[name] = body; write(f, body); rs.sendStatus(200)})
}

app.r('post', '/ask', async ({ body }, rs) => {
  if (!body.mod || !$.system_prompts[body.mod] || !body.chat?.length)
    throw `ASK validation [${body.mod}][${$.system_prompts[body.mod]}][${body.chat?.length}]`

  body.sp_override = body.sp_override || $.system_prompts[body.mod]
  body.kb_override = body.kb_override || $.knowledge_base

  if (!body.skip_gk) {
    try {
      const gk_answer = await ask(gk, body.sp_override.gatekeeper, body.chat)
      console.log(gk_answer)
      if (gk_answer === 'IGNORE')    return rs.send('')
      if (gk_answer !== 'ESCALATE')  return rs.send(gk_answer)
    } catch(e) {console.error(`🚩 gatekeeper failed: `, e.message)}
  }

  const kb = !body.skip_kb ?
    '# KNOWLEDGE BASE:\n' +
      body.kb_override.map(e => `## ${e.key}\n${e.content}`).join('\n\n')
    : ''

  let caps = ''
  if (!body.skip_caps && body.sp_override.capabilities && Object.keys($.capabilities).length) {
    const list = Object.entries($.capabilities)
      .map(([k, v]) => `- ${k}: ${v.description}`).join('\n')
    caps = body.sp_override.capabilities + '\n# CAPABILITIES:\n' + list
  }

  const query = [body.sp_override.main, caps, kb].join('\n\n')

  for (const llm of [m1, m2, m3]) {
    try      {return rs.send(await ask(llm, query, body.chat))}
    catch(e) {console.error(`🚩 ${llm[1]} failed:`, e.message)}
  }
  rs.send("The assistance is not available at the moment. Please try again later.")
})

app.r('get', '/last_prompt', (_, rs) => {rs.sendFile('data/last_prompt.json', {root: '.'})})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 MSSG: ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

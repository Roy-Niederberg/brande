import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import OpenAI from 'openai'
const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use('/ask', rateLimit({ windowMs: 20000, max: 5, message: 'Try again later' }))
app.r = (vrb,u,f)=>app[vrb](u,async (rq,rs,nxt)=>{try{ await f(rq,rs,nxt)} catch(e) {nxt(e)}})

// =============== Server Loading section =======================================================//
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/'
const GROQ = 'https://api.groq.com/openai/v1'
const GEM_KEY1 = fs.readFileSync('/run/secrets/gemini_1', 'utf-8').trim()
const GEM_KEY2 = fs.readFileSync('/run/secrets/gemini_2', 'utf-8').trim()
const GRK_KEY1 = fs.readFileSync('/run/secrets/groq_1'  , 'utf-8').trim()
const GRK_KEY2 = fs.readFileSync('/run/secrets/groq_2'  , 'utf-8').trim()

const $ = {}

const crud = (...names) => names.forEach(name => {
  $[name] = JSON.parse(fs.readFileSync(`./data/${name}.json`, 'utf-8'))
  app.r('get',  '/' + name, (_, rs) => rs.json($[name]))
  app.r('post', '/' + name, ({ body }, rs) => {
    $[name] = body
    fs.writeFileSync(`./data/${name}.json`, JSON.stringify(body, null, 2), 'utf-8')
    rs.sendStatus(200)
  })
})

const gk_fmt = { response_format: { type: 'json_schema', json_schema: {
  name: 'gatekeeper_response', schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['REPLY', 'IGNORE', 'ESCALATE'] },
      text:   { type: 'string' }
    },
    required: ['action']
  }
}}}

const gk = [new OpenAI({apiKey: GRK_KEY1, baseURL: GROQ  }), 'openai/gpt-oss-20b', gk_fmt]
const m1 = [new OpenAI({apiKey: GEM_KEY2, baseURL: GEMINI}), 'gemini-2.5-flash']
const m2 = [new OpenAI({apiKey: GEM_KEY1, baseURL: GEMINI}), 'gemini-2.5-flash-lite']
const m3 = [new OpenAI({apiKey: GRK_KEY2, baseURL: GROQ  }), 'openai/gpt-oss-120b']

const ask = async (llm, content, msgs) => {
  const r = await llm[0].chat.completions.create({
    model: llm[1],
    messages: [{ role: 'system', content }, ...msgs],
    ...llm[2]
  })
  return r.choices[0]?.message?.content || ''
}

// =============== Endpoints ====================================================================//
app.r('post', '/ask', async ({ body }, rs) => {
  if (!body.mod || !$.system_prompts[body.mod] || !body.chat?.length)
    throw `ASK validation [${body.mod}][${$.system_prompts[body.mod]}][${body.chat?.length}]`

  body.sp_override = body.sp_override || $.system_prompts[body.mod]
  body.kb_override = body.kb_override || $.knowledge_base

  //Ask the GATEKEEPER if and what we need to ask the main model.
  try {
    const gk_answer = JSON.parse(await ask(gk, body.sp_override.gatekeeper, body.chat))
    if (gk_answer.action === 'REPLY')  return rs.send(gk_answer.text)
    if (gk_answer.action === 'IGNORE') return rs.send('     😖     ')
  } catch(e) {console.error(`gatekeeper failed: `, e.message)}

  // Passed the gatekeeper, Build the prompt
  const kb   = body.kb_override.map(e => `## ${e.key}\n${e.content}`).join('\n\n')
  const query = body.sp_override.main + "\n#KNOWLEDGE BASE:\n" + kb

  for (const llm of [m1, m3, m2]) {
    try      {return rs.send(await ask(llm, query, body.chat))}
    catch(e) {console.error(`🚩 ${llm[1]} failed:`, e.message)}
  }
  rs.send("The assistance is not available at the moment. Please try again later.")
})

crud('knowledge_base', 'system_prompts', 'greeting')

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`${e.response?.data || e.message}\n${e.stack}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

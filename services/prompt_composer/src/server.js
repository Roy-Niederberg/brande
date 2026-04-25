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
const gk2 = [new Groq({apiKey:GRK_2}),'qwen/qwen3-32b']
const gk3 = [new Groq({apiKey:GRK_3}),'openai/gpt-oss-120b']
const gk4 = [new Groq({apiKey:GRK_4}),'qwen/qwen3-32b']
const mb3 = [new GoogleGenAI({apiKey:GEM_3}),'gemini-2.5-flash-lite']
const mb4 = [new GoogleGenAI({apiKey:GEM_4}),'gemini-2.5-flash-lite']
const m1 = [new GoogleGenAI({apiKey:GEM_1}),'gemini-2.5-flash', ...mb3]
const m2 = [new GoogleGenAI({apiKey:GEM_2}),'gemini-2.5-flash', ...mb4]


const askGroq = async (llm, content, msgs) => {
  const ask_obj = {model: llm[1], messages: [{role: 'system', content}, ...msgs]}
  try {
    const r = await llm[0].chat.completions.create(ask_obj)
    const res = (r.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '')
    fs.writeFileSync('./logs/last_prompt.json', JSON.stringify({...ask_obj, res}))
    return res
  } catch (e) {console.error(`🚩 failed [${llm[1]}]:`, e.message)}
}

const askGemini = async (llm, system, msgs) => {
  const contents = msgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.content}]
  }))
  for (const i of [0,2]) { // with retry
    const ask_obj = {model: llm[i + 1], config: {systemInstruction: system}, contents}
    try {
      const r = await llm[i].models.generateContent(ask_obj)
      const res = r.text
      fs.writeFileSync('./logs/last_prompt.json', JSON.stringify({...ask_obj, res}))
      return res
    } catch (e) {console.error(`🚩 failed [${llm[i+1]}]:`, e.message)}
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

  const sp = trusted ? body.sp_override : $.system_prompts[body.mod]
  const kb_obj = (trusted && body.kb_override) || $.knowledge_base

  let [ans_1, ans_2] = [undefined, undefined]

  console.log("\n\n===============================================================\n\n")

  for (let i = 0; i < 3; ++i) { // 3 tries

    if (!body.skip_gk) {
      [ans_1, ans_2] = await Promise.all([
        askGroq(gk1, parse(sp.gatekeeper, body.local_time), body.chat),
        askGroq(gk2, parse(sp.gatekeeper, body.local_time), body.chat),
      ])
    }
    if (ans_1 == "IGNORE" && ans_2 == "IGNORE") return rs.send("...")

    console.log(ans_1)
    console.log('--------------------------------------------------')
    console.log(ans_2)
    console.log('--------------------------------------------------')

    if (!ans_1 || !ans_2 || ans_1 === 'ESCALATE' || ans_2 === 'ESCALATE') {
      const kb = '# KNOWLEDGE BASE:\n' +
        kb_obj.map(e => `## ${e.key}\n${e.content}`).join('\n\n')

      let caps = ''
      if (sp.capabilities && Object.keys($.capabilities).length) {
        const list = Object.entries($.capabilities)
        .map(([k, v]) => `- ${k}: ${v.description}`).join('\n')
        caps = sp.capabilities + '\n\n# CAPABILITIES:\n' + list
      }

      const query = [sp.main, caps, kb].join('\n\n')

      ;[ans_1, ans_2] = await Promise.all([
        askGemini(m1, query, body.chat),
        askGemini(m2, query, body.chat),
      ])
    }

    console.log(ans_1)
    console.log('--------------------------------------------------')
    console.log(ans_2)
    console.log('--------------------------------------------------')

    const p = `
You are a quality judge for a customer-facing AI assistant.

Conversation history:
${JSON.stringify(body.chat, null, 2)}

Two candidate replies:

* OPTION 1:
${ans_1}

* OPTION 2:
${ans_2}

Reply NONE if EITHER option:
- Contains internal reasoning, thinking markers, or meta-text not meant for the user (e.g. "_THOUGHT", "I need to ask...", "My plan:", slot tracking notes)
- Is off-topic, factually wrong, or ignores the user's question
- Contains broken formatting, garbled text, or mixed languages inappropriately

Otherwise pick the better reply. If similar quality, favor the shorter one.
Reply with a single word: "OPTION1", "OPTION2", or "NONE".
`
    const [verdict_1, verdict_2] = (await Promise.all([
      askGroq(gk3, p, [{role: "user", content: "What is your verdict?"}]),
      askGroq(gk4, p, [{role: "user", content: "What is your verdict?"}]),
    ])).map(v => v?.match(/OPTION[12]|NONE/)?.[0])

    console.log(verdict_1)
    console.log('--------------------------------------------------')
    console.log(verdict_2)
    console.log('--------------------------------------------------')

    if      (verdict_1 === verdict_2 && verdict_1 === "OPTION1") {return rs.send(ans_1)}
    else if (verdict_1 === verdict_2 && verdict_1 === "OPTION2") {return rs.send(ans_2)}
    else if (verdict_1 === "OPTION2" || verdict_2 === "OPTION2") {return rs.send(ans_2)}

    console.log(`Try ${i} failed. something went wrong.`)
  }

  rs.send("The assistant is unavailable at the moment. Please try again later.")
})

app.r('get', '/last_prompt', (_, rs) => {rs.sendFile('logs/last_prompt.json', {root: '.'})})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

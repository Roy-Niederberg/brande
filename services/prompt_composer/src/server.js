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
const toJS = (v,d=0) => typeof v==='string' ? '`'+v.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${')+'`' : '{\n'+Object.entries(v).map(([k,w])=>`${'  '.repeat(d+1)}${k}: ${toJS(w,d+1)}`).join(',\n')+'\n'+'  '.repeat(d)+'}'
const writeJSObj = (f, d) => writeFile(f, `export default ${toJS(d)}\n`)

// =============== Server Loading section =======================================================//
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/'
const GROQ = 'https://api.groq.com/openai/v1'
const GEM_1 = fs.readFileSync('/run/secrets/gemini_1', 'utf-8').trim()
const GEM_2 = fs.readFileSync('/run/secrets/gemini_2', 'utf-8').trim()
const GRK_1 = fs.readFileSync('/run/secrets/groq_1'  , 'utf-8').trim()
const GRK_2 = fs.readFileSync('/run/secrets/groq_2'  , 'utf-8').trim()
// const GRK_3 = fs.readFileSync('/run/secrets/groq_3'  , 'utf-8').trim()
// const GRK_4 = fs.readFileSync('/run/secrets/groq_4'  , 'utf-8').trim()
const ADMIN_SECRET = fs.readFileSync('/run/secrets/admin_secret', 'utf-8').trim()

const gk1 = [new OpenAI({apiKey:GRK_1,baseURL:GROQ}),'openai/gpt-oss-120b']
const gk2 = [new OpenAI({apiKey:GRK_2,baseURL:GROQ}),'groq/compound-mini']
// const gk3 = [new OpenAI({apiKey:GRK_3,baseURL:GROQ}),'openai/gpt-oss-120b']
// const gk4 = [new OpenAI({apiKey:GRK_4,baseURL:GROQ}),'groq/compound-mini']
const m1 = [new OpenAI({apiKey:GEM_2,baseURL:GEMINI}),'gemini-2.5-flash-lite']
const m2 = [new OpenAI({apiKey:GEM_1,baseURL:GEMINI}),'gemini-2.5-flash-lite']

const ask = async (llm, content, msgs) => {
  const ask_obj = {model: llm[1], messages: [{ role: 'system', content }, ...msgs]}
  try {
    const r = await llm[0].chat.completions.create(ask_obj)
    const response = r.choices[0]?.message?.content || ''
    writeJSON('last_prompt.json', { ...ask_obj, response })
    return response
  } catch (e) {console.error(`🚩 failed [${llm[1]}]:`, e.message)}
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

  console.log(headers['x-admin-secret'])
  console.log(trusted)
  console.log(sp.gatekeeper)
  console.log(body.chat)

  let answer = undefined

  for (let i = 0; i < 3; ++i) { // 3 tries
    if (!body.skip_gk) answer = await ask(gk1, parse(sp.gatekeeper, body.local_time), body.chat)
    if (answer !== 'ESCALATE') return rs.send(answer)

    const kb = '# KNOWLEDGE BASE:\n' +
      kb_obj.map(e => `## ${e.key}\n${e.content}`).join('\n\n')

    let caps = ''
    if (sp.capabilities && Object.keys($.capabilities).length) {
      const list = Object.entries($.capabilities)
      .map(([k, v]) => `- ${k}: ${v.description}`).join('\n')
      caps = sp.capabilities + '\n\n# CAPABILITIES:\n' + list
    }
    console.log(caps)

    const query = [sp.main, caps, kb].join('\n\n')

    const [m1_ans, m2_ans] = await Promise.allSettled([
      ask(m1, query, body.chat),
      ask(m2, query, body.chat),
    ])

    const m1_ans_f = m1_ans.status === 'fulfilled' ?
      m1_ans.value : (console.error(`🚩 m2 failed:`, m1_ans.reason.message), undefined)
    const m2_ans_f = m2_ans.status === 'fulfilled' ? 
      m2_ans.value : (console.error(`🚩 m2 failed:`, m2_ans.reason.message), undefined)

    const p = `
This is a conversation history between a user and a AI assistance: 
${JSON.stringify(body.chat, null, 2)}

And these are two possible assistance replays answers:

* OPTION 1:
${m1_ans_f}

* OPTION 2:
${m2_ans_f}

Please assest both answers and choose which one is better.
Replay with a single word:
"OPTION1" - if you think option 1 is better
"OPTION2" - if you think option 2 is better
"NONE" - if both are not good.
`
    const verdict = await ask(gk2, p, [{role: "user", content: "What is your call?"}])
    if      (verdict === "OPTION1") {answer = m1_ans_f }
    else if (verdict === "OPTION2") {answer = m2_ans_f }
    else if (verdict === "NONE")    {answer = undefined}
    else {answer = undefined}

    if (answer !== undefined) { break }
    console.log(`Try ${i} failed. something went wronge.`)
  }

  rs.send(answer ?? "The assistance is unavailable at the moment. Please try again later.")
})

app.r('get', '/last_prompt', (_, rs) => {rs.sendFile('data/last_prompt.json', {root: '.'})})

// =============== Error handling middleware ====================================================//
app.use((e, _, rs, _n) => {
  console.error(`🚩 ${e.response?.data || e.message}\nSTACK: ${e.stack}\nERR: ${e}`)
  rs.sendStatus(500)
})
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

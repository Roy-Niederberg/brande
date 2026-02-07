import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
let prompts = JSON.parse(fs.readFileSync('./data/system_prompts.json', 'utf-8'))
import _knowledge_base from '../data/knowledge_base.json' with { type: 'json' }

const app = express()
app.set('trust proxy', true)
app.use(express.json())
app.use(express.text())
app.use(rateLimit({ windowMs: 20000, max: 5, message: 'Try again later', validate: { trustProxy: false } }))

// =============== Util Functions ====================================================================================//
const write  = (dir, name, content) => fs.writeFileSync(`./${dir}/${name}.txt`, content, 'utf-8')
const secret = (name) => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()

// Express Error handline routs: catch exeptions in routs and and handle them in "Error handling middleware".
app.r = (vrb, url, f) => app[vrb](url, async (rq, rs, nxt) => { try { await f(rq, rs, nxt) } catch (e) { nxt(e) } })

// =============== Server Loading section ============================================================================//
// In this section the server should fail in case of error and not startup. ==========================================//
let knowledge_base = _knowledge_base

// LLMs loading
import OpenAI from 'openai';

// GATEKEEPER MODEL
const gatekeeper = new OpenAI({
  apiKey: secret('groq_key_1'),
  baseURL: 'https://api.groq.com/openai/v1'
})
gatekeeper.ask = async (c, q) => {
  const r = await gatekeeper.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: c },
      { role: 'user', content: q }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'gatekeeper_response',
        schema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['REPLY', 'IGNORE', 'ESCALATE'] },
            text:   { type: 'string' }
          },
          required: ['action']
        }
      }
    }
  })
  return { text: r.choices[0]?.message?.content || '' }
}

// MAIN MODLES
const llm1 = new OpenAI({
  apiKey: secret('gemini_key_2'),
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
})

llm1.ask = async (q, c) => {
  const r = await llm1.chat.completions.create({
    model: 'gemini-2.5-flash-lite',
    messages: [
      { role: 'system', content: c },
      { role: 'user', content: q }
    ]
  })
  return { text: r.choices[0]?.message?.content || '' }
}

const llm2 = new OpenAI({
  apiKey: secret('gemini_key_1'),
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
})

llm2.ask = async (q, c) => {
  const r = await llm2.chat.completions.create({
    model: 'gemini-2.5-flash-lite',
    messages: [
      { role: 'system', content: c },
      { role: 'user', content: q }
    ]
  })
  return { text: r.choices[0]?.message?.content || '' }
}

const llm3 = new OpenAI({
  apiKey: secret('groq_key_2'),
  baseURL: 'https://api.groq.com/openai/v1'
})

llm3.ask = async (q, c) => {
  const r = await llm3.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: c },
      { role: 'user', content: q }
    ]
  })
  return { text: r.choices[0]?.message?.content || '' }
}

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//
app.r('post', '/ask', async ({ body }, rs) => {
  if (!body.module || !prompts[body.module]) {
    rs.send(`NO MUDULE [${body.module}]`);
    return;
  }

  const c_prompts = prompts[body.module]

  const chat_history = body.chat_data?.chat_history
  console.log(chat_history)

  if (!chat_history) {
    rs.json(c_prompts.greeting);
    return;
  }

  //Ask the GATEKEEPER if and what we need to ask the main model.
  try {
    const gk_answer = JSON.parse((await gatekeeper.ask(c_prompts.gatekeeper, chat_history)).text)
    if (gk_answer.action === 'REPLY') {rs.send(gk_answer.text); console.log('GK-replay'); return}
    if (gk_answer.action === 'IGNORE') {rs.send('(empty)'); console.log('GK-ignored'); return}
  } catch(e) {console.error(`gatekeeper faild: `, e.message)}

  // Passed the gatekeeper, Build the prompt
  const kb = body.chat_data.knowledge_base_override || knowledge_base
  const client_question = body.chat_data.system_prompt_override?.[body.module] || c_prompts.client_question
  const prompt = client_question + "\n#KNOWLEDG BASE:\n" + kb.map(e => `## ${e.key}\n${e.content}`).join('\n\n')
  write('prompt_log', `${body.module}_prompt`, `${prompt}\n${chat_history}`)


  console.log('TRYING with Gemini 1')
  try {rs.send('' + (await llm1.ask(prompt, chat_history)).text); return} catch(e) {console.error(`gemini 1 failed: `, e.message)}

  console.log('TRYING with Gemini 2')
  try {rs.send('' + (await llm2.ask(prompt, chat_history)).text); return} catch(e) {console.error(`gemini 2 failed: `, e.message)}

  console.log('TRYING with Grok 1')
  try {rs.send('' + (await llm3.ask(prompt, chat_history)).text); return} catch(e) {console.error(`Grok 1 failed: `, e.message)}

  rs.send("The assistance is not available at the moment. Please try again later.")
})

app.r('get', '/knowledge-base', (_, rs) => rs.json(knowledge_base))
app.r('post', '/knowledge-base',
  ({ body }, rs) => (knowledge_base = body, fs.writeFileSync('./data/knowledge_base.json', JSON.stringify(body, null, 2), 'utf-8'), rs.sendStatus(200)))

app.r('get', '/prompt-instructions', (_, rs) => {
  const result = {}
  for (const [mod, data] of Object.entries(prompts)) result[mod] = data.client_question
  rs.json(result)
})
app.r('post', '/prompt-instructions', ({ body }, rs) => {
  for (const [mod, text] of Object.entries(body)) {
    if (prompts[mod]) prompts[mod].client_question = text
  }
  fs.writeFileSync('./data/system_prompts.json', JSON.stringify(prompts, null, 4), 'utf-8')
  rs.sendStatus(200)
})

// =============== Error handling middleware =========================================================================//
app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

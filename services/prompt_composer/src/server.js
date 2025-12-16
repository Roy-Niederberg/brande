import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import fb_comments from '../data/fb_comments_query_builder.js'
import fb_messages from '../data/fb_messages_query_builder.js'
import admin_ui    from '../data/admin_query_builder.js'
import widget      from '../data/widget_query_builder.js'

const query_builders = { fb_comments, fb_messages, admin_ui, widget }
const app = express()
app.use(express.json())
app.use(express.text())
app.use(rateLimit({ windowMs: 60000, max: 20, message: 'PC: Too many requests' }))

// =============== Util Functions ====================================================================================//
const read   = (name) => fs.readFileSync(`./data/${name}.txt`, 'utf-8')
const write  = (dir, name, content) => fs.writeFileSync(`./${dir}/${name}.txt`, content, 'utf-8')
const secret = (name) => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()

// Express Error handline routs: catch exeptions in routs and and handle them in "Error handling middleware".
app.r = (vrb, url, f) => app[vrb](url, async (rq, rs, nxt) => { try { await f(rq, rs, nxt) } catch (e) { nxt(e) } })

// =============== Server Loading section ============================================================================//
// In this section the server should fail in case of error and not startup. ==========================================//
let instructions        = read('instructions')
let knowledge_base      = read('knowledge_base')
let role                = read('role')
let response_guidelines = read('response_guidelines')

// LLMs loading
import { GoogleGenAI } from "@google/genai";
import { Groq } from 'groq-sdk';

// GATEKEEPER MODEL
// const gatekeeperModel = (new GoogleGenAI({apiKey: secret('gemini_api_key')})).getGenerativeModel({
//     model: "gemini-1.5-flash",
//     generationConfig: { temperature: 0, responseMimeType: "application/json" }
// })

// MAIN MODLES
const llm_1 = new GoogleGenAI({apiKey: secret('gemini_key_1')})
llm_1.ask = async (q) => await llm_1.models.generateContent({model: "gemini-flash-lite-latest", contents: q})

const llm_2 = new GoogleGenAI({apiKey: secret('gemini_key_2')})
llm_2.ask = async (q) => await llm_2.models.generateContent({model: "gemini-flash-lite-latest", contents: q})

const llm_3 = new Groq({apiKey: secret('groq_key_1')})
llm_3.ask = async (q) => {
  const r = await llm_3.chat.completions.create({messages: [{role: "user", content: q}], model: "openai/gpt-oss-120b"})
  return {text: r.choices[0]?.message?.content || ''}
}

const llm_4 = new Groq({apiKey: secret('groq_key_2')})
llm_4.ask = async (q) => {
  const r = await llm_4.chat.completions.create({messages: [{role: "user", content: q}], model: "openai/gpt-oss-120b"})
  return {text: r.choices[0]?.message?.content || ''}
}

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//
app.r('post', '/ask', async ({ body }, rs) => {
  // Build the prompt
  const query = query_builders[body.module](body.chat_data)
  const prompt = [role, instructions, knowledge_base, query, response_guidelines].join('').trim()
  write('prompt_log', `${body.module}_prompt`, prompt)

  // Try to get answer for LLMs
  console.log('TRYING with GROQ')
  try {rs.send((await llm_3.ask(prompt)).text); return} catch(e) {console.error(`GROQ failed: `, e.message)}

  console.log('TRIYING GEMINI 1')
  try {rs.send((await llm_1.ask(prompt)).text); return} catch(e) {console.error(`GEMINI 1 failed: `, e.message)}

  console.log('TRIYING with GEMINI 2')
  try {rs.send((await llm_2.ask(prompt)).text); return} catch(e) {console.error(`GEMINI 2 failed: `, e.message)}

  console.log('TRYING with GROQ 2')
  try {rs.send((await llm_4.ask(prompt)).text); return} catch(e) {console.error(`GROQ 2 failed: `, e.message)}

  rs.send("The assistance is not available at the moment. Please try again later.")
})

app.r('get', '/knowledge-base', (_, rs) => rs.send(knowledge_base))
app.r('get', '/prompt-instructions', (_, rs) => rs.send(instructions))
app.r('post', '/reload-knowledge-base', (_, rs) => (knowledge_base = read('knowledge_base'), rs.sendStatus(200)))
app.r('post', '/reload-instructions', (_, rs) => (instructions = read('instructions'), rs.sendStatus(200)))
app.r('post', '/instructions',
  ({ body }, rs) => (instructions = body, write('data', 'instructions', body), rs.sendStatus(200)))
app.r('post', '/knowledge-base',
  ({ body }, rs) => (knowledge_base = body, write('data', 'knowledge_base', body), rs.sendStatus(200)))

// =============== Error handling middleware =========================================================================//
app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

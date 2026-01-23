import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import facebook_comments from '../data/fb_comments_query_builder.js'
import facebook_messages from '../data/fb_messages_query_builder.js'
import admin_ui from '../data/admin_query_builder.js'
import widget from '../data/widget_query_builder.js'
import gk_query from '../data/gatekeeper_query_builder.js'
import prompts from '../data/system_prompts.json' with { type: 'json' }

const query_builders = { facebook_comments, facebook_messages, admin_ui, widget }
const app = express()
app.set('trust proxy', true)
app.use(express.json())
app.use(express.text())
app.use(rateLimit({ windowMs: 20000, max: 5, message: 'Try again later', validate: { trustProxy: false } }))

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
const gatekeeper = new GoogleGenAI({apiKey: secret('gemini_key_1')})
gatekeeper.ask = async (c, q) => await gatekeeper.models.generateContent({
  model: "gemini-flash-lite-latest",
  contents: q,
  config: {
    systemInstruction: c,
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: "OBJECT",
      properties: {
        action: { type: "STRING", enum: ["REPLY", "IGNORE", "ESCALATE"] },
        text:   { type: "STRING", nullable: true }},
      required: ["action"]}}})

// MAIN MODLES
const llm1 = new GoogleGenAI({apiKey: secret('gemini_key_2')})
llm1.ask = async (q, c) => await llm1.models.generateContent({
  model: "gemini-flash-lite-latest",
  contents: q,
  config: {
    systemInstruction: c,
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: "STRING"}}})

const llm3 = new Groq({apiKey: secret('groq_key_1')})
llm3.ask = async (c) => {
  const r = await llm3.chat.completions.create({
    messages: [{role: "system", content: c}],
    model: "openai/gpt-oss-20b"})
  return {text: r.choices[0]?.message?.content || ''}}

const llm4 = new Groq({apiKey: secret('groq_key_2')})
llm4.ask = async (c) => {
  const r = await llm4.chat.completions.create({
    messages: [{role: "system", content: c}],
    model: "openai/gpt-oss-20b"})
  return {text: r.choices[0]?.message?.content || ''} }

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//
app.r('post', '/ask', async ({ body }, rs) => {

  // Ask the GATEKEEPER if and what we need to ask the main model.
  const chat_history = body.chat_data.chat_history
  try {
    const gk_answer = JSON.parse((await gatekeeper.ask(gk_query(), chat_history)).text)
    if (gk_answer.action === 'REPLY') {rs.send('(gk)\n ' + gk_answer.text); return}
    if (gk_answer.action === 'IGNORE') {rs.send('(gk empty)'); console.log('ignored'); return}
  } catch(e) {console.error(`goalkeeper faild: `, e.message)}

  // Passed the gatekeeper, Build the prompt
  // const query = query_builders[body.module](body.chat_data)
  const kb = body.chat_data.knowledge_base_override || knowledge_base
  // const prompt = [role, instructions, kb, query, response_guidelines].join('').trim()
  const prompt = prompts.client_question + "#KNOWLEDG BASE:\n" + kb + "#CHAT:\n" + chat_history
  write('prompt_log', `${body.module}_prompt`, prompt)
  console.log(prompt)

  // Try to get answer for LLMs
  // console.log('TRIYING GEMINI')
  // try {rs.send((await llm1.ask(prompt)).text); return} catch(e) {console.error(`GEMINI 1 failed: `, e.message)}

  console.log('TRYING with GROQ 1')
  try {rs.send('(grok1)\n' + (await llm3.ask(prompt)).text); return} catch(e) {console.error(`GROQ 1 failed: `, e.message)}

  console.log('TRYING with GROQ 2')
  try {rs.send('(grok2)\n' + (await llm4.ask(prompt)).text); return} catch(e) {console.error(`GROQ 2 failed: `, e.message)}

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

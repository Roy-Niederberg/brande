import fs from 'fs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import * as llm_manager from './llm_manager.js'
import facebook_comments from '../data/fb_comments_query_builder.js'
import facebook_messages from '../data/fb_messages_query_builder.js'
import admin_ui from '../data/admin_query_builder.js'
import widget from '../data/widget_query_builder.js'
const query_builders = { facebook_comments, facebook_messages, admin_ui, widget }
const app = express()
app.use(express.json())
app.use(express.text())
app.use(rateLimit({ windowMs: 60000, max: 20, message: 'PC: Too many requests' }))

// =============== Util Functions ====================================================================================//

const read = (name, ex = 'txt') => fs.readFileSync(`./data/${name}.${ex}`, 'utf-8')
const write = (dir, name, content, ex = 'txt') => fs.writeFileSync(`./${dir}/${name}.${ex}`, content, 'utf-8')
const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()

// Express Error handline routs: catch exeptions in routs and and handle them in "Error handling middleware".
const G = async (rq, rs, nxt, f) => { console.log(rq.path, rq.query?.query || ''); return await f(rq, rs, nxt) }
app.r = (vrb, url, f) => { app[vrb](url, (rq, rs, nxt) => { G(rq, rs, nxt, f).catch(nxt) }) }

// =============== Server Loading section ============================================================================//
// In this section the server should fail in case of error and not startup. ==========================================//

let instructions = read('instructions')
let knowledge_base = read('knowledge_base')
const role = read('role')
const response_guidelines = read('response_guidelines')

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//

app.r('get', '/ask', async ({ query: { query } }, rs) => {
  const prompt = [role, instructions, knowledge_base, query, response_guidelines].join('').trim()
  write('prompt_log', Date.now(), prompt)
  rs.send(await llm_manager.generate(prompt))
})
app.r('post', '/ask', async ({ body }, rs) => {
  const query = query_builders[body.module](body.chat_data)
  const prompt = [role, instructions, knowledge_base, query, response_guidelines].join('').trim()
  write('prompt_log', `prompt_${Date.now()}`, prompt)
  const answer = await llm_manager.generate(prompt)
  write('prompt_log', `answer_${Date.now()}`, answer)
  rs.send(answer)
})

app.r('get', '/knowledge-base',
  (_, rs) => rs.send(knowledge_base))
app.r('get', '/prompt-instructions',
  (_, rs) => rs.send(instructions))
app.r('post', '/reload-knowledge-base',
  (_, rs) => (knowledge_base = read('knowledge_base'), rs.sendStatus(200)))
app.r('post', '/reload-instructions',
  (_, rs) => (instructions = read('instructions'), rs.sendStatus(200)))
app.r('post', '/instructions',
  ({ body }, rs) => (instructions = body, write('data', 'instructions', body), rs.sendStatus(200)))
app.r('post', '/knowledge-base',
  ({ body }, rs) => (knowledge_base = body, write('data', 'knowledge_base', body), rs.sendStatus(200)))

// =============== Error handling middleware =========================================================================//

app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

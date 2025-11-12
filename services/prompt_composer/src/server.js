import fs from 'fs'
import express from 'express'
import axios from 'axios'
import facebook_comments from '../data/facebook_query_builder.js'
import admin_ui from '../data/admin_query_builder.js'
const query_builders = { facebook_comments, admin_ui }
const app = express()
app.use(express.json())
app.use(express.text())

// =============== Util Functions ====================================================================================//

const read = (name, ex = 'txt') => fs.readFileSync(`./data/${name}.${ex}`, 'utf-8')
const write = (name, content, ex = 'txt') => fs.writeFileSync(`./data/${name}.${ex}`, content, 'utf-8')
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
const llm_api_key = read_scrt('llm_api_key')
const url = process.env.LLM
const { data, cfg } = JSON.parse(read('llm_config','json'))
fs.mkdirSync('./data/prompt_log', { recursive: true })

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//
//
app.r('get', '/ask', async ({ query: { query } }, rs) => {
  data.contents[0].parts[0].text = [role, instructions, knowledge_base, query, response_guidelines].join('').trim()
  write(`prompt_log/${Date.now()}`, data.contents[0].parts[0].text)
  rs.send((await axios.post(`${url}?key=${llm_api_key}`, data, cfg)).data.candidates[0].content.parts[0].text)
})
app.r('post', '/ask', async ({ body }, rs) => {
  const query = query_builders[body.module](body.chat_data)
  data.contents[0].parts[0].text = [role, instructions, knowledge_base, query, response_guidelines].join('').trim()
  write(`prompt_log/${Date.now()}`, data.contents[0].parts[0].text)
  rs.send((await axios.post(`${url}?key=${llm_api_key}`, data, cfg)).data.candidates[0].content.parts[0].text)
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
  ({ body }, rs) => (instructions = body, write('instructions', body), rs.sendStatus(200)))
app.r('post', '/knowledge-base',
  ({ body }, rs) => (knowledge_base = body, write('knowledge_base', body), rs.sendStatus(200)))

// =============== Error handling middleware =========================================================================//

app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500) })
app.use('*', (_, rs) => rs.sendStatus(404))
app.listen(4321, ()=> console.log('Server Start Up'))

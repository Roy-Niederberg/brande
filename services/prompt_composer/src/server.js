const fs = require('fs')
const express = require('express')
const axios = require('axios')
const app = express()

// =============== Util Functions ====================================================================================//
const read = (name, ex = 'txt') => fs.readFileSync(`./data/${name}.${ex}`, 'utf-8')
const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const G = async (rq, rs, nxt, f) => { console.log(rq.path, rq.query?.query || ''); return await f(rq, rs, nxt) }
// Express Error handline routs: catch exeptions in routs and and handle them in "Error handling middleware".
app.r = (vrb, url, f) => { app[vrb](url, (rq, rs, nxt) => { G(rq, rs, nxt, f).catch(nxt) }) }

// =============== Server Loading section ============================================================================//
// In this section the server should fail in case of error and not startup. ==========================================//
let instructions = read('instructions')
let knowledge_base = read('knowledge_base')
const role = read('role')
const response_guidelines = read('response_guidelines')
const llm_api_key = read_scrt('llm_api_key')
const url = process.env.LLM || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
const { data, cfg } = JSON.parse(read('llm_config','json'))

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//
app.r('get', '/ask', async ({ query: { query } }, rs) => {
  data.contents[0].parts[0].text = [role, instructions, knowledge_base, query, response_guidelines].join('')
  rs.send((await axios.post(`${url}?key=${llm_api_key}`, data, cfg)).data.candidates[0].content.parts[0].text.trim())
})
app.r('get', '/knowledge-base', (_, rs) => rs.send(knowledge_base))
app.r('get', '/prompt-instructions', (_, rs) => rs.send(instructions))
app.r('post', '/reload-knowledge-base', (_, rs) => (knowledge_base = read('knowledge_base'), rs.sendStatus(200)))
app.r('post', '/reload-instructions', (_, rs) => (instructions = read('instructions'), rs.sendStatus(200)))

// Error handling middleware
app.use((e, _, rs, _nxt) => { console.error(e.response?.data || e.message, `\n${e.stack}`), rs.sendStatus(500)})
app.use('*', (_, rs) => rs.sendStatus(404))

app.listen(4321, '0.0.0.0', ()=> console.log('Server Start Up'))

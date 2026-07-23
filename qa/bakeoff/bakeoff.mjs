// Hebrew bake-off: Gemini flash (current main) vs Groq gpt-oss-120b vs DeepSeek-V4-Flash
// (DeepInfra), same prompt + KB. Mirrors prompt-composer's /ask composition
// (services/prompt_composer/src/server.js) so the answers are comparable to prod. Single-turn,
// gatekeeper skipped.
//
// Answers are cached in out/answers-<client>.json — re-runs only ask models with missing or
// errored answers, so adding a model/question doesn't re-spend quota on the others. Each run
// regenerates the blind report: answers shuffled into A/B/C in results-*.md; the model mapping
// (+ latency) is only in key-*.json — judge first, peek after.
//
// The composed prompt is ~5-6k tokens, so Groq's free-tier 8k TPM allows ~1 call/min per org —
// hence key rotation + 25s backoff below.
//
// Run from repo root (no host node needed):
//   docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd):/repo" -w /repo node:22-alpine \
//     node qa/bakeoff/bakeoff.mjs [client]      # default client: drlipokatz
import fs from 'fs'

const root = new URL('../..', import.meta.url).pathname
const client = process.argv[2] || 'drlipokatz'
const secret = n => {
  const p = `${root}secrets/clients_secrets/${n}.secret`
  if (!fs.existsSync(p)) { console.error(`missing key — put it in ${p}`); process.exit(1) }
  return fs.readFileSync(p, 'utf-8').trim()
}
const GROQ_KEYS = [1, 2, 3, 4].map(i => secret(`groq_${i}`))
// free-tier flash pair first (prod primary); tier-1 billed pair as fallback — same model,
// different billing account, so quota-dead free keys don't leave holes in the report
const GEM_KEYS = [3, 4, 1, 2].map(i => secret(`gemini_${i}`))
const DEEPINFRA_KEYS = [secret('deepinfra_1')]
const sleep = ms => new Promise(r => setTimeout(r, ms))

// data files are ESM with bare `export default`; import via data: URL to dodge CJS resolution
const impDefault = async f =>
  (await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(f, 'utf-8')))).default
const data = `${root}clients/${client}/data`
const sp = (await impDefault(`${data}/system_prompts.js`)).widget
const kb_obj = JSON.parse(fs.readFileSync(`${data}/knowledge_base.json`, 'utf-8'))
const capabilities = await impDefault(`${data}/capabilities.js`)
const questions = JSON.parse(fs.readFileSync(`${root}qa/bakeoff/questions.json`, 'utf-8'))

const kb = '# KNOWLEDGE BASE:\n' + kb_obj.map(e => `## ${e.key}\n${e.content}`).join('\n\n')
let caps = ''
if (sp.capabilities && Object.keys(capabilities).length)
  caps = sp.capabilities + '\n\n# CAPABILITIES:\n' +
    Object.entries(capabilities).map(([k, v]) => `- ${k}: ${v.description}`).join('\n')
const system = [sp.main, caps, kb].join('\n\n')

const askGemini = model => async (q, key) => {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' +
    `${model}:generateContent?key=${key}`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      system_instruction: {parts: [{text: system}]},
      contents: [{role: 'user', parts: [{text: q}]}],
      generationConfig: {thinkingConfig: {thinkingLevel: 'MEDIUM'}}
    })
  })
  if (!r.ok) throw new Error(`${model} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const parts = (await r.json()).candidates?.[0]?.content?.parts ?? []
  return parts.filter(p => p.text && !p.thought).map(p => p.text).join('')
}

// OpenAI-compatible chat endpoint (Groq + DeepInfra)
const askOpenAI = (url, model, extra = {}) => async (q, key) => {
  const r = await fetch(url, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: {'content-type': 'application/json', authorization: `Bearer ${key}`},
    body: JSON.stringify({model, ...extra,
      messages: [{role: 'system', content: system}, {role: 'user', content: q}]})
  })
  if (!r.ok) throw new Error(`${model} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return (await r.json()).choices[0].message.content
}

// rotate keys per attempt; 25s backoff between attempts (Groq free tier: 8k TPM per org)
const withKeys = (keys, fn) => async q => {
  for (let a = 0; ; a++) {
    const t = Date.now()
    try { return {res: await fn(q, keys[a % keys.length]), ms: Date.now() - t} }
    catch (e) {
      if (a >= 3) return {res: `⚠️ ERROR: ${e.message}`, ms: -1}
      console.log(`  retry ${a + 1}: ${e.message.slice(0, 90)}`)
      await sleep(25000)
    }
  }
}

const models = {
  gemini: withKeys(GEM_KEYS, askGemini('gemini-3.5-flash')),
  // what prod actually serves once free flash quota drains (billed keys, per server.js pairing)
  gemini_lite: withKeys([1, 2].map(i => secret(`gemini_${i}`)),
    askGemini('gemini-3.1-flash-lite')),
  groq: withKeys(GROQ_KEYS, // default reasoning_effort (medium) — matches prod askGroq
    askOpenAI('https://api.groq.com/openai/v1/chat/completions', 'openai/gpt-oss-120b')),
  groq_high: withKeys(GROQ_KEYS,
    askOpenAI('https://api.groq.com/openai/v1/chat/completions', 'openai/gpt-oss-120b',
      {reasoning_effort: 'high'})),
  deepseek: withKeys(DEEPINFRA_KEYS,
    askOpenAI('https://api.deepinfra.com/v1/openai/chat/completions',
      'deepseek-ai/DeepSeek-V4-Flash'))
}

const outDir = `${root}qa/bakeoff/out`
fs.mkdirSync(outDir, {recursive: true})
const cachePath = `${outDir}/answers-${client}.json`
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {}

for (const [i, q] of questions.entries()) {
  cache[q] ??= {}
  let called = false
  for (const name of Object.keys(models)) {
    if (cache[q][name] && !cache[q][name].res.startsWith('⚠️')) continue
    cache[q][name] = await models[name](q)
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1))
    console.log(`${i + 1}/${questions.length} ${name}: ${cache[q][name].ms}ms`)
    called = true
  }
  if (called) await sleep(6000) // pace for free-tier RPM/TPM
}

// regenerate the blind report from the full cache
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const letters = ['A', 'B', 'C', 'D', 'E']
const key = []
const blind = []
const md = [`# Bake-off — ${client} — ${stamp}`, '',
  'Same system prompt + KB as prod, single-turn. Judge blind, then open the key file.']
for (const [i, q] of questions.entries()) {
  const names = Object.keys(models).sort(() => Math.random() - 0.5)
  const row = {q, ms: {}}
  md.push('', `## ${i + 1}. ${q}`)
  blind.push({q, answers: names.map((n, j) => {
    row[letters[j]] = n
    row.ms[n] = cache[q][n].ms
    md.push('', `**${letters[j]}:**`, '', cache[q][n].res)
    return {letter: letters[j], model: n, ms: cache[q][n].ms, res: cache[q][n].res}
  })})
  key.push(row)
}
fs.writeFileSync(`${outDir}/results-${stamp}.md`, md.join('\n') + '\n')
fs.writeFileSync(`${outDir}/key-${stamp}.json`, JSON.stringify(key, null, 2))
const payload = JSON.stringify({client, stamp, questions: blind}).replaceAll('</', '<\\/')
fs.writeFileSync(`${outDir}/judge-${stamp}.html`,
  fs.readFileSync(`${root}qa/bakeoff/judge-template.html`, 'utf-8')
    .replace('__DATA__', () => payload))
console.log(`→ qa/bakeoff/out/{results-${stamp}.md, key-${stamp}.json, judge-${stamp}.html}`)

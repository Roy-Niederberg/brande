import fs from 'fs'
import { query } from '@anthropic-ai/claude-agent-sdk'

// ------------------------------------------------------------------------------------------------
// Telegram agent — a per-client Claude Code instance reachable from a Telegram group chat.
// Long-polls getUpdates (no inbound port, like the notifier) with this client's own bot token —
// Telegram allows only ONE poller per token, hence one BotFather bot per client. Each allowed
// message runs a Claude Code turn over the read-only mounts (data/, logs/, private/), so Roy &
// Nevo can ask "which model replied just now?" from a phone. READ-ONLY by two fences: the tool
// list below (no Bash/Write/Edit) and the :ro mounts in docker-compose. Write support later will
// go through prompt-composer's admin_secret CRUD API, not raw file writes.
// Sessions: chat -> session_id kept on the claude volume, so context survives restarts. /new
// resets. Allowed user ids live in ./data/telegram.json (read per message — live edits); messages
// from anyone else are ignored and logged, which is also how you discover your id when setting up.
// ------------------------------------------------------------------------------------------------
const BOT_TOKEN = fs.readFileSync('/run/secrets/telegram_bot_token', 'utf-8').trim()
const CRED      = fs.readFileSync('/run/secrets/claude_credential', 'utf-8').trim()
// One secret, two auth flavors: `claude setup-token` subscription tokens are sk-ant-oat...,
// console API keys sk-ant-api... Set exactly one env var — ANTHROPIC_API_KEY outranks the
// OAuth token in Claude Code's credential precedence, so never set both.
const AUTH      = CRED.startsWith('sk-ant-oat')
  ? {CLAUDE_CODE_OAUTH_TOKEN: CRED} : {ANTHROPIC_API_KEY: CRED}
const API       = `https://api.telegram.org/bot${BOT_TOKEN}`
const MODEL     = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
const SESSIONS  = '/root/.claude/telegram-sessions.json'

const tg = async (method, body) => {
  const res  = await fetch(`${API}/${method}`, {method: 'POST',
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
  const data = await res.json()
  if (!data.ok) throw new Error(`telegram ${method}: ${data.description}`)
  return data.result
}

const sessions     = fs.existsSync(SESSIONS) ? JSON.parse(fs.readFileSync(SESSIONS, 'utf-8')) : {}
const saveSessions = () => fs.writeFileSync(SESSIONS, JSON.stringify(sessions))
const allowedUsers = () => {   // missing/broken file = allow nobody, but keep the poller alive
  try { return JSON.parse(fs.readFileSync('./data/telegram.json', 'utf-8')).users }
  catch (e) { console.error('🚩 telegram.json:', e.message); return [] }
}

const systemPrompt = () => {
  const title = JSON.parse(fs.readFileSync('./private/client-config.json', 'utf-8')).title
  return `You are the operations assistant for "${title}", a Qabu client (a RAG chat agent for a
small business). You chat with the owners (Roy & Nevo) over Telegram. Everything is mounted
read-only under /app:
- data/     — knowledge_base.json, system_prompts.js (gatekeeper + main), greeting.json,
              capabilities.js, notify.json
- logs/     — last_prompt.json (the last prompt sent to the LLM, incl. which model answered),
              events.jsonl (one line per answered customer message; drained daily by the notifier)
- private/  — client-config.json and site assets
Answer questions about the logs, events, prompts and KB. You CANNOT change anything yet — if
asked to edit, say write support is coming and point to the admin panel at /admin.
Reply in the language you were asked in. Plain text only (no markdown — Telegram shows it raw).
Keep answers short and phone-friendly; expand only when asked.`
}

const runTurn = async (chatId, text) => {
  let reply = ''
  for await (const msg of query({prompt: text, options: {
    model: MODEL, resume: sessions[chatId], cwd: '/app',
    systemPrompt: systemPrompt(),
    allowedTools: ['Read', 'Grep', 'Glob'],    // auto-approved; anything else is denied headless
    disallowedTools: ['Bash', 'Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task'],
    // No bypassPermissions: redundant with the tool lists, and the CLI refuses it as root
    settingSources: [], maxTurns: 30,
    env: {...process.env, ...AUTH},
    stderr: d => console.error('claude:', d.toString().trim()),
  }})) {
    if (msg.session_id && msg.session_id !== sessions[chatId]) { // resume forks to a NEW id
      sessions[chatId] = msg.session_id
      saveSessions()
    }
    if (msg.type === 'result') reply = msg.subtype === 'success' ? msg.result : `🚩 ${msg.subtype}`
  }
  return reply || '🚩 no result'
}

const send = async (chatId, text) => {           // Telegram caps messages at 4096 chars
  for (let i = 0; i < text.length; i += 4000)
    await tg('sendMessage', {chat_id: chatId, text: text.slice(i, i + 4000)})
}

const typing = chatId => setInterval(() =>       // "typing…" lasts ~5s, refresh while working
  tg('sendChatAction', {chat_id: chatId, action: 'typing'}).catch(() => {}), 4000)

const handle = async m => {
  if (!m?.text) return
  if (!allowedUsers().includes(m.from?.id))
    return console.log(`ignored: user ${m.from?.id} in chat ${m.chat.id} (${m.chat.title || 'dm'})`)
  if (m.text.split('@')[0] === '/new') {         // group commands arrive as /new@botname
    delete sessions[m.chat.id]
    saveSessions()
    return send(m.chat.id, 'Started a fresh session.')
  }
  const t = typing(m.chat.id)
  try { await send(m.chat.id, await runTurn(m.chat.id, m.text)) }
  catch (e) {
    console.error('🚩', e)
    await send(m.chat.id, `🚩 ${e.message} (try /new if this keeps failing)`).catch(() => {})
  } finally { clearInterval(t) }
}

let offset = 0
const poll = async () => {
  while (true) {
    try {
      const updates = await tg('getUpdates', {offset, timeout: 50, allowed_updates: ['message']})
      for (const u of updates) { offset = u.update_id + 1; await handle(u.message) }
    } catch (e) {
      console.error('🚩 poll:', e.message)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}

poll()
console.log(`Telegram agent start up — model ${MODEL}`)

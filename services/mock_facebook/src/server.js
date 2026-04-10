import fs from 'fs'
import express from 'express'
const app = express()

app.use('/assets', express.static('data'))

const defaultAvatar = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
  '<rect width="40" height="40" rx="20" fill="%23e4e6eb"/>' +
  '<circle cx="20" cy="16" r="7" fill="%2365676b"/>' +
  '<ellipse cx="20" cy="34" rx="12" ry="10" fill="%2365676b"/></svg>')}`

app.get('/', (_, res) => {
  const dataPath = 'data/post-data.json'
  const d = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    : { pageName: 'Page', pageCategory: 'Business',
        publishedBy: 'Admin', direction: 'ltr',
        postText: 'Welcome to our page!' }
  const dir = d.direction || 'ltr'
  const align = dir === 'rtl' ? 'right' : 'left'
  const pic = '/mock-facebook/assets/profile-pic.jpg'
  const postImg = '/mock-facebook/assets/post-image.jpg'
  res.send(/*html*/`<!DOCTYPE html>
<html lang="${dir === 'rtl' ? 'he' : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${d.pageName}'s Post</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Helvetica, Arial, sans-serif; background:#f0f2f5;
  display:flex; justify-content:center; min-height:100vh; }
.wrap { width:100%; max-width:500px; background:#fff; min-height:100vh;
  box-shadow:0 1px 2px rgba(0,0,0,.1); }
.hdr { display:flex; align-items:center; justify-content:space-between;
  padding:12px 16px; border-bottom:1px solid #ddd; position:sticky;
  top:0; background:#fff; z-index:10; }
.hdr-title { font-size:15px; font-weight:700; }
.hdr-x { width:30px; height:30px; border-radius:50%; background:#e4e6eb;
  border:none; font-size:18px; cursor:pointer; display:flex;
  align-items:center; justify-content:center; color:#606770; }
.author { display:flex; gap:10px; padding:12px 16px; align-items:center; }
.avatar { width:40px; height:40px; border-radius:50%; object-fit:cover; }
.author-info { flex:1; }
.author-name { font-size:14px; font-weight:700; color:#050505; }
.author-meta { font-size:12px; color:#65676b; }
.dots { font-size:20px; color:#65676b; cursor:pointer; letter-spacing:-2px; }
.post-text { padding:0 16px 12px; font-size:15px; line-height:1.4;
  color:#050505; text-align:${align}; direction:${dir}; }
.post-img { width:100%; max-height:30vh; object-fit:cover; display:block; }
.page-bar { display:flex; align-items:center; justify-content:space-between;
  padding:10px 16px; border-top:1px solid #ddd; }
.page-bar-left { display:flex; flex-direction:column; }
.page-bar-name { font-size:14px; font-weight:700; color:#050505; }
.page-bar-cat { font-size:12px; color:#65676b; }
.send-msg { background:none; border:1px solid #ddd; border-radius:6px;
  padding:6px 12px; font-size:13px; color:#65676b; cursor:pointer;
  display:flex; align-items:center; gap:4px; }
.insights { display:flex; justify-content:space-between; align-items:center;
  padding:10px 16px; border-top:1px solid #ddd; }
.insights a { font-size:13px; color:#1877f2; text-decoration:none; }
.boost { background:#1877f2; color:#fff; border:none; border-radius:6px;
  padding:6px 14px; font-size:13px; font-weight:600; cursor:pointer; }
.actions { display:flex; border-top:1px solid #ddd;
  border-bottom:1px solid #ddd; }
.act-btn { flex:1; display:flex; align-items:center; justify-content:center;
  gap:6px; padding:10px 0; background:none; border:none; font-size:14px;
  color:#65676b; cursor:pointer; }
.act-btn:hover { background:#f0f2f5; }
.act-icon { width:20px; height:20px; }
.comments { padding:8px 16px; }
.comment { display:flex; gap:8px; margin-bottom:12px; }
.comment .avatar { width:32px; height:32px; flex-shrink:0; }
.comment-bubble { background:#f0f2f5; border-radius:12px; padding:8px 12px;
  max-width:calc(100% - 44px); }
.comment-bubble.agent { background:#e7f3ff; }
.comment-author { font-size:13px; font-weight:700; color:#050505; }
.comment-text { font-size:14px; color:#050505; line-height:1.3;
  white-space:pre-wrap; word-wrap:break-word; }
.comment-time { font-size:11px; color:#65676b; margin-top:2px;
  padding-inline-start:4px; }
.typing { color:#65676b; font-size:13px; padding:4px 0 8px 44px;
  display:none; }
.typing.visible { display:block; }
.comment-box { display:flex; align-items:center; gap:8px;
  padding:10px 16px; border-top:1px solid #ddd; }
.comment-box .avatar { width:32px; height:32px; }
.comment-input { flex:1; border:1px solid #ddd; border-radius:18px;
  padding:8px 14px; font-size:14px; outline:none; font-family:inherit;
  direction:${dir}; }
.comment-input:focus { border-color:#1877f2; }
.send-comment { background:#1877f2; color:#fff; border:none;
  border-radius:50%; width:32px; height:32px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; }
.send-comment:disabled { background:#bec3c9; cursor:not-allowed; }
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">${d.pageName}'s Post</div>
    <button class="hdr-x">&times;</button>
  </div>

  <div class="author">
    <img class="avatar" src="${pic}" onerror="this.src='${defaultAvatar}'"
      alt="${d.pageName}">
    <div class="author-info">
      <div class="author-name">${d.pageName}</div>
      <div class="author-meta">
        Published by ${d.publishedBy} &middot; Just now &middot;
        &#x1F310;
      </div>
    </div>
    <span class="dots">&middot;&middot;&middot;</span>
  </div>

  <div class="post-text">${d.postText}</div>

  <img class="post-img" src="${postImg}"
    onerror="this.src='/assets/background.png'" alt="Post image">

  <div class="page-bar">
    <div class="page-bar-left">
      <span class="page-bar-name">${d.pageName}</span>
      <span class="page-bar-cat">${d.pageCategory}</span>
    </div>
    <button class="send-msg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="#65676b" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2
          2 0 012 2z"/>
      </svg>
      Send message
    </button>
  </div>

  <div class="insights">
    <a href="#">See insights and ads</a>
    <button class="boost">Boost post</button>
  </div>

  <div class="actions">
    <button class="act-btn">
      <svg class="act-icon" viewBox="0 0 24 24" fill="none"
        stroke="#65676b" stroke-width="2">
        <path d="M14 9V5a3 3 0 00-6 0v1H5a2 2 0 00-2 2v7a2 2
          0 002 2h3l1 4h2l1-4h3a2 2 0 002-2V8a2 2 0 00-2-2h-1z"/>
      </svg>
      Like
    </button>
    <button class="act-btn">
      <svg class="act-icon" viewBox="0 0 24 24" fill="none"
        stroke="#65676b" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2
          2 0 012 2z"/>
      </svg>
      Comment
    </button>
    <button class="act-btn">
      <svg class="act-icon" viewBox="0 0 24 24" fill="none"
        stroke="#65676b" stroke-width="2">
        <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
      Share
    </button>
  </div>

  <div class="comments"></div>
  <div class="typing">Typing...</div>

  <div class="comment-box">
    <img class="avatar" src="${pic}" onerror="this.src='${defaultAvatar}'"
      alt="${d.pageName}">
    <input class="comment-input" placeholder="Write a comment...">
    <button class="send-comment" disabled>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </button>
  </div>
</div>
<script>
(function() {
  const pageName = ${JSON.stringify(d.pageName)}
  const thread = []

  const commentsEl = document.querySelector('.comments')
  const typingEl = document.querySelector('.typing')
  const input = document.querySelector('.comment-input')
  const sendBtn = document.querySelector('.send-comment')

  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  })
  sendBtn.addEventListener('click', submit)

  function fmtDate(d) {
    const mo = d.toLocaleString('en-US', { month: 'short' })
    const day = d.getDate()
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return mo + ' ' + day + ', ' + h + ':' + m
  }

  function addComment(author, text, isAgent) {
    const now = new Date()
    thread.push({ author, text, time: now, isAgent })
    const div = document.createElement('div')
    div.className = 'comment'
    div.innerHTML =
      '<div class="comment-bubble' + (isAgent ? ' agent' : '') + '">' +
        '<div class="comment-author">' + esc(author) + '</div>' +
        '<div class="comment-text">' + esc(text) + '</div>' +
        '<div class="comment-time">' + fmtDate(now) + '</div>' +
      '</div>'
    commentsEl.appendChild(div)
    div.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  function esc(t) {
    const d = document.createElement('div')
    d.textContent = t; return d.innerHTML
  }

  function buildChatHistory() {
    return thread.map(c => {
      const prefix = c.isAgent ? '[AGENT] ' + c.author : c.author
      const date = fmtDate(c.time)
      const msg = c.text.replace(/\\s+/g, ' ').trim()
      return '- ' + prefix + ' (' + date + '): "' + msg + '"'
    }).join('\\n')
  }

  function readDrafts() {
    const body = {}
    try {
      const kb = JSON.parse(localStorage.getItem('kb_draft'))
      if (kb && kb.content) body.knowledgeBaseOverride = kb.content
    } catch {}
    try {
      const sp = JSON.parse(localStorage.getItem('sp_draft'))
      if (sp && sp.content) {
        const filtered = sp.content.filter(
          e => e.key.startsWith('facebook_comments/'))
        if (filtered.length) {
          body.systemPromptOverride = {}
          for (const e of filtered)
            body.systemPromptOverride[e.key.split('/')[1]] = e.content
        }
      }
    } catch {}
    return body
  }

  async function submit() {
    const text = input.value.trim()
    if (!text) return
    input.value = ''; sendBtn.disabled = true

    addComment('Customer', text, false)

    const chatHistory = buildChatHistory()
    const chat = [{ role: 'user', content: chatHistory }]
    const overrides = readDrafts()

    typingEl.classList.add('visible')
    try {
      const res = await fetch('/admin/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mod: 'facebook_comments', chat, ...overrides
        })
      })
      const reply = await res.text()
      addComment(pageName, reply, true)
    } catch (e) {
      addComment('System', 'Error: ' + e.message, false)
    }
    typingEl.classList.remove('visible')
    input.focus()
  }
})()
</script>
</body>
</html>`)
})

app.listen(4321, () => console.log('Mock Facebook service started'))

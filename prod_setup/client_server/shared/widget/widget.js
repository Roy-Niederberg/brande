(function() {
  // Read global configuration
  const config = window.ChatWidgetConfig || {}
  const targetElement = config.targetElement
    ? (typeof config.targetElement === 'string'
        ? document.querySelector(config.targetElement)
        : config.targetElement)
    : document.body // Default to body if not specified
  targetElement.dir ='ltr'
  const canvasElement = config.canvasElement
    ? (typeof config.canvasElement === 'string'
        ? document.querySelector(config.canvasElement)
        : config.canvasElement)
    : null
  const API = config.apiEndpoint || '/site/ask'
  const STORAGE_KEY = 'chat_history'
  const history = []
  let lastMsgRole = null
  let lastMsgMinute = null

  // Load per-client capabilities
  const capabilities = import('/site/capabilities')
    .then(m => m.default || {}).catch(() => ({}))

  const parseActions = (text) => {
    const idx = text.indexOf('\n|| ACTIONS')
    if (idx === -1) return { text, actions: [] }
    const actions = text.slice(idx).split('\n')
      .filter(l => l.startsWith('|| ') && l !== '|| ACTIONS')
      .map(l => {
        const parts = l.slice(3).split(' ')
        return { name: parts[0], args: parts.slice(1).join(' ') }
      })
    return { text: text.slice(0, idx).trimEnd(), actions }
  }

  // Font configuration
  const defaultFontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
  const fontFamilyCSS = config.fontFamily || defaultFontFamily

  // Load Google Font if URL provided
  if (config.googleFontsUrl) {
    const linkEl = document.createElement('link')
    linkEl.rel = 'stylesheet'
    linkEl.href = config.googleFontsUrl
    document.head.appendChild(linkEl)
  }

  const css = `
    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    #chat-widget {
      position: relative;
      width: 100%;
      height: 100%;
      animation: none;
      z-index: 1;
      font-family: ${fontFamilyCSS};
    }

    #chat-box {
      display: flex;
      flex-direction: column;
      gap: 0;
      background-color: #F8F9FA;
      padding: 0;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.03);
      height: 100%;
    }

    #chat-header {
      display: flex;
      align-items: center;
      padding: 15px 16px;
      background: #FFFFFF;
      color: #0F2C59;
      flex-shrink: 0;
      position: relative;
      z-index: 10;
      gap: 12px;
      box-sizing: border-box;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }

    .chat-header-avatar {
      width: 52px; height: 52px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .chat-header-name {
      font-size: 23px; font-weight: 700; flex: 1;
      display: flex; flex-direction: column; gap: 4px; justify-content: center;
    }
    .chat-header-subtitle {
      font-size: 12px; font-weight: 400; color: #3276AA;
    }
    .chat-header-menu-btn {
      width: 32px; height: 32px; border-radius: 50%;
      background: transparent; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #3276AA;
      transition: background 0.2s;
    }
    .chat-header-menu-btn:hover { background: rgba(0,0,0,0.05); }
    .chat-header-dropdown {
      display: none; position: absolute;
      top: 100%; right: 12px;
      background: #ffffff; border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      min-width: 180px; overflow: hidden; z-index: 20;
    }
    .chat-header-dropdown-item {
      padding: 12px 16px; color: #0F2C59;
      font-size: 14px; cursor: pointer;
      transition: background 0.15s;
      display: flex; align-items: center; gap: 8px;
    }
    .chat-header-dropdown-item:hover { background: #f0f0f0; }

    #chat-messages {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px 0;
      margin: 0;
      scroll-behavior: smooth;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,0.1) transparent;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }

    #chat-messages::-webkit-scrollbar { width: 6px; }
    #chat-messages::-webkit-scrollbar-track { background: transparent; }
    #chat-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    #chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }

    .msg-row { display: flex; align-items: flex-start; width: 100%; }
    .msg-row.bot { flex-direction: row; padding-right: 4px; }
    .msg-row.user { flex-direction: row-reverse; padding-left: 4px; }
    .msg-row ~ .msg-row { margin-top: 8px; }
    .msg-row.grouped { margin-top: 1px; }

    .chat-msg {
      padding: 10px 14px;
      border-radius: 12px;
      width: 88%;
      word-wrap: break-word;
      font-size: 18px;
      line-height: 1.5;
      pointer-events: auto;
      opacity: 0;
      animation: slideInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      will-change: transform, opacity;
      white-space: pre-wrap;
    }

    .chat-msg a { text-decoration: underline; }
    .chat-msg.bot a { color: #3276AA; }

    .chat-msg ul {
      margin: 4px 0;
      padding-left: 0;
      list-style-position: inside;
    }

    .chat-timestamp {
      font-size: 11px; opacity: 0.5; pointer-events: none;
      padding: 2px 8px; white-space: nowrap; flex-shrink: 0;
    }

    .chat-msg.user {
      background: #A6D0DD;
      color: #0F2C59;
      text-align: start;
      border: none;
      margin-right: -12px;
      padding-right: 24px;
      border-radius: 12px 0 0 12px;
      box-shadow: -4px 4px 12px rgba(166,208,221,0.3), -2px 2px 4px rgba(0,0,0,0.1);
    }

    .chat-msg.bot {
      background: #FFFFFF;
      color: #0F2C59;
      border: 1px solid rgba(0,0,0,0.06);
      margin-left: -12px;
      padding-left: 24px;
      border-radius: 0 12px 12px 0;
      box-shadow: 4px 4px 12px rgba(0,0,0,0.08), 2px 2px 4px rgba(0,0,0,0.04);
    }

    .msg-row.ghost-row { flex-direction: column; align-items: flex-end; }

    .chat-msg.ghost-input {
      animation: none;
      opacity: 1;
      background: rgba(166, 208, 221, 0.1);
      border: 1px solid rgba(166, 208, 221, 0.35);
      min-height: 1.5em;
      outline: none;
      cursor: text;
      white-space: pre-wrap;
    }

    .ghost-send-btn {
      background: #0F2C59;
      border: 1.5px solid #0F2C59;
      cursor: pointer;
      color: #F8F9FA;
      padding: 6px 14px;
      margin: 10px 16px 0 0;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      font-size: 15px;
      font-family: inherit;
      border-radius: 16px;
      transition: background 0.2s;
    }
    .ghost-send-btn:hover { background: #1a3d6e; }

    #chat-widget.left-handed .ghost-send-btn { align-self: flex-start; margin: 10px 0 0 16px; }
    #chat-hand-item svg { transform: scaleX(-1); }
    #chat-widget.left-handed #chat-hand-item svg { transform: scaleX(1); }

    @media (max-width: 600px) {
      .chat-msg { font-size: 15px; }
      .msg-row ~ .msg-row { margin-top: 6px; }
      .msg-row.grouped { margin-top: 1px; }
      .chat-header-avatar { width: 46px; height: 46px; }
      .chat-header-avatar svg { width: 26px; height: 26px; }
      .chat-header-name { font-size: 15px; }
      #chat-header { padding: 12px 12px; gap: 10px; }
    }
  `

  const html = `
    <div id="chat-box">
      <div id="chat-header">
        <div class="chat-header-avatar">
          <svg width="48" height="48" viewBox="-603 -603 1206 1206">
            <path transform="rotate(135) scale(1)" fill="#0F2C59" d="M -43.934 -600L -43.934 0C -102.948 -160.66 -102.944 -248.528 -175.736 -175.736A 248.528 248.528 0 1 0 43.934 -244.614L 43.934 -804.594C 87.868 -512.132 248.528 -600 424.264 -424.264A 600 600 0 1 1 -43.934 -600"></path>
          </svg>
        </div>
        <div class="chat-header-name">
          <span>${config.clientName || 'Qab\u00fb'}</span>
          <span class="chat-header-subtitle">Qab\u00fb AI assistance</span>
        </div>
        <button class="chat-header-menu-btn" id="chat-menu-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="4" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="10" cy="16" r="2"/>
          </svg>
        </button>
        <div class="chat-header-dropdown" id="chat-dropdown">
          <div class="chat-header-dropdown-item" id="chat-clear-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Clear conversation
          </div>
          <div class="chat-header-dropdown-item" id="chat-hand-item">
            <svg width="16" height="16" viewBox="0 0 64 64" fill="currentColor" style="flex-shrink:0"><path d="M61.529 29.137c-.856-1.662-2.515-2.615-4.55-2.615c-3.247 0-6.296 2.957-8.987 5.566c-1.245 1.207-2.52 2.443-3.569 3.113l4.447-22.527c.425-1.82.103-3.523-.905-4.793c-.953-1.201-2.461-1.918-4.034-1.918c-2.006 0-4.568 1.252-5.182 4.723l-2.055 8.553V8.715C36.694 4.307 33.751 2 30.843 2c-2.906 0-5.85 2.307-5.85 6.715V19.58l-2.79-10.238c-.705-3.039-3.054-4.123-5.017-4.123c-1.733 0-3.372.785-4.386 2.1c-.978 1.27-1.266 2.914-.822 4.59l1.94 8.861l-2.444-4.797c-1.025-2.014-2.709-3.168-4.62-3.168c-1.667 0-3.253.898-4.14 2.346c-.939 1.531-.956 3.434-.026 5.26c2.807 4.949 7.26 13.484 7.26 15.32c0 .529-.054 1.279-.116 2.148c-.267 3.734-.714 9.984 1.752 15.514c2.261 5.066 9.051 8.605 16.512 8.607c8.69 0 15.945-4.697 19.903-12.887c1.76-3.641 5.697-8.412 9.575-11.604c1.736-1.427 5.801-4.777 3.955-8.372m-50.113 6.584c0-2.898-6.268-14.117-7.501-16.291c-1.897-3.727 3.356-6.385 5.334-2.5L16.5 31.012l.615-2.457l-3.719-17.094c-1.051-3.973 5.469-6.266 6.521-1.74l5.418 20l1.047-2.291V8.742c0-6.24 8.036-6.26 8.036-.021v21.416l1.699-1.895l4-17.25c.928-5.227 7.225-3.074 6.261 1.063l-4.541 23.963c-6.729-.238-16.119 4.293-15.054 14.359c.857-9.309 9.397-12.416 15.199-12.416c2.209 0 2.949-.25 7.324-4.938c7.415-7.943 10.309-4.027 10.221-2.344c-.301 5.76-10.154 7.695-14.606 17.416c-5.846 12.762-22.854 13.279-29.961 7.146c-5.266-4.544-3.544-18.919-3.544-19.52"/></svg>
            Left-handed mode
          </div>
        </div>
      </div>
      <div id="chat-messages">
        <div id="scroll-spacer"></div>
      </div>
    </div>
  `

  const style = document.createElement('style')
  try {
    style.textContent = css
    document.head.appendChild(style)
  } catch (e) {
    console.error('Error injecting CSS:', e)
    console.log('CSS Content:', css)
  }

  const widget = document.createElement('div')
  widget.id = 'chat-widget'
  widget.innerHTML = html

  targetElement.appendChild(widget)

  const messages = document.getElementById('chat-messages')
  const appendMsg = el => { const sp = document.getElementById('scroll-spacer'); sp ? messages.insertBefore(el, sp) : messages.appendChild(el) }
  const menuBtn = document.getElementById('chat-menu-btn')
  const dropdown = document.getElementById('chat-dropdown')
  const clearItem = document.getElementById('chat-clear-item')

  let menuOpen = false
  menuBtn.onclick = (e) => { e.stopPropagation(); menuOpen = !menuOpen; dropdown.style.display = menuOpen ? 'block' : 'none' }
  document.addEventListener('click', () => { if (menuOpen) { menuOpen = false; dropdown.style.display = 'none' } })

  const handItem = document.getElementById('chat-hand-item')
  const HAND_KEY = 'chat_left_handed'
  const applyHand = (left) => {
    widget.classList.toggle('left-handed', left)
    handItem.childNodes[handItem.childNodes.length - 1].textContent =
      left ? ' Right-handed mode' : ' Left-handed mode'
  }
  applyHand(localStorage.getItem(HAND_KEY) === '1')
  handItem.onclick = () => {
    const left = !widget.classList.contains('left-handed')
    localStorage.setItem(HAND_KEY, left ? '1' : '0')
    applyHand(left)
    menuOpen = false; dropdown.style.display = 'none'
  }

  const parseMarkdown = (text) => {
    let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic sanitization
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/(?<!\w)_(.*?)_(?!\w)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(?<![="'])((?:https?:\/\/|www\.)[^\s<]+)/g, (_, url) => {
      const href = url.startsWith('www.') ? 'https://' + url : url
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
    })
    .replace(/^\s*[\*\-]\s+(.*)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\s*)+)/g, (m) => '<ul>' + m.replace(/\n/g, '') + '</ul>')
    return html.replace(/\n/g, '<br>')
  }

  const getTextDirection = (text) => {
    // Remove numbers and common punctuation/symbols to detect natural language direction
    const cleanText = text.replace(/[0-9\.,!\?\-\+\(\)\[\]\{\}"'#@%&*\^$£€~`|\\\/<>:;]/g, '')
    if (!cleanText.trim()) return 'ltr' // Default to LTR if only numbers/symbols

    const hebrewCount = (cleanText.match(/[\u0590-\u05FF]/g) || []).length
    const totalCount = cleanText.length

    // If significant portion (>30%) of remaining text is Hebrew, assume RTL
    return (hebrewCount / totalCount) > 0.3 ? 'rtl' : 'ltr'
  }

  let restoring = false

  const addMsg = (content, role, time) => {
    const row = document.createElement('div')
    row.className = `msg-row ${role}${role === lastMsgRole ? ' grouped' : ''}`

    const msg = document.createElement('div')
    msg.className = `chat-msg ${role}`
    msg.innerHTML = parseMarkdown(content)
    msg.dir = getTextDirection(content)
    if (restoring) {
      msg.style.animation = 'none'
      msg.style.opacity = '1'
    } else {
      const visibleCount = messages.querySelectorAll('.chat-msg').length
      msg.style.animationDelay = `${Math.min(visibleCount, 5) * 0.05}s`
    }

    row.appendChild(msg)

    const d = time ? new Date(time) : new Date()
    const minuteKey = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    if (role !== lastMsgRole || minuteKey !== lastMsgMinute) {
      const timestamp = document.createElement('span')
      timestamp.className = 'chat-timestamp'
      timestamp.textContent = minuteKey
      row.appendChild(timestamp)
    }
    lastMsgRole = role
    lastMsgMinute = minuteKey

    appendMsg(row)

    setTimeout(() => {
      messages.scrollTo({
        top: messages.scrollHeight,
        behavior: 'smooth'
      })
    }, 100)
  }

  const addPendingBubble = (delay = 500) => {
    let timeoutId
    const promise = new Promise(resolve => {
      timeoutId = setTimeout(() => {
        const row = document.createElement('div')
        row.className = `msg-row bot${lastMsgRole === 'bot' ? ' grouped' : ''}`
        const msg = document.createElement('div')
        msg.className = 'chat-msg bot'
        msg.innerHTML = '\u2026'
        const d = new Date()
        const minuteKey = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        row.appendChild(msg)
        if (lastMsgRole !== 'bot' || minuteKey !== lastMsgMinute) {
          const timestamp = document.createElement('span')
          timestamp.className = 'chat-timestamp'
          timestamp.textContent = minuteKey
          row.appendChild(timestamp)
        }
        lastMsgRole = 'bot'
        lastMsgMinute = minuteKey
        appendMsg(row)
        setTimeout(() => messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' }), 100)
        resolve(msg)
      }, delay)
    })
    promise.cancel = () => clearTimeout(timeoutId)
    return promise
  }

  const tokenizeHTML = (html) => {
    const tokens = []
    let i = 0
    while (i < html.length) {
      if (html[i] === '<') {
        const end = html.indexOf('>', i)
        if (end === -1) { tokens.push({ value: html[i], visible: true }); i++; continue }
        tokens.push({ value: html.slice(i, end + 1), visible: false })
        i = end + 1
      } else if (html[i] === '&') {
        const end = html.indexOf(';', i)
        if (end === -1) { tokens.push({ value: html[i], visible: true }); i++; continue }
        tokens.push({ value: html.slice(i, end + 1), visible: true })
        i = end + 1
      } else {
        tokens.push({ value: html[i], visible: true })
        i++
      }
    }
    return tokens
  }

  const typewriteInBubble = async (bubble, text, abort) => {
    const segments = text.split(/\n\n+/)
    for (let s = 0; s < segments.length; s++) {
      if (abort.stopped) { bubble.innerHTML = parseMarkdown(segments[s]); return }
      if (s > 0) {
        bubble = await addPendingBubble(0)
        await new Promise(r => setTimeout(r, 500))
      }
      if (abort.stopped) { bubble.innerHTML = parseMarkdown(segments[s]); return }
      const html = parseMarkdown(segments[s])
      bubble.dir = getTextDirection(segments[s])
      const tokens = tokenizeHTML(html)
      let rendered = ''
      for (const token of tokens) {
        if (abort.stopped) { bubble.innerHTML = html; return }
        rendered += token.value
        bubble.innerHTML = rendered
        const d = token.value === '<br>' ? 80
          : !token.visible ? 0
          : token.value === ' ' ? 30
          : token.value === ',' ? 40
          : token.value === '.' ? 80
          : 10
        if (d) await new Promise(r => setTimeout(r, d))
        if (token.value === '<br>') messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' })
      }
      messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' })
    }
  }

  const saveHistory = () => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)) } catch {}
  }

  const restoreHistory = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (!saved) return false
      const entries = JSON.parse(saved)
      if (!entries.length) return false
      restoring = true
      for (const entry of entries) {
        if (!entry.hidden) addMsg(entry.content, entry.role === 'user' ? 'user' : 'bot', entry.time)
        history.push(entry)
      }
      restoring = false
      return true
    } catch { return false }
  }

  let greetingAbort = null

  const playGreeting = async () => {
    const abort = { stopped: false }
    greetingAbort = abort
    try {
      let data
      if (config.greetingOverride) {
        data = config.greetingOverride()
      } else {
        const res = await fetch(API.replace('/ask', '/greeting'))
        if (!res.ok || abort.stopped) return
        data = (await res.json()).widget
      }
      if (!data?.messages?.length || abort.stopped) return
      for (const msg of data.messages) {
        if (abort.stopped) break
        await new Promise(r => setTimeout(r, msg.delay || 1000))
        if (abort.stopped) break
        const bubble = await addPendingBubble(0)
        await typewriteInBubble(bubble, msg.text, abort)
        if (abort.stopped) break
        history.push({ role: 'assistant', content: msg.text, time: Date.now() })
        saveHistory()
      }
    } catch { /* greeting failed — widget still works */ }
    if (!abort.stopped) greetingAbort = null
  }

  const callLLM = async (abort, skipGk) => {
    const chat = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant', content: h.content
    }))
    let requestBody = { mod: 'widget', chat }
    if (skipGk) requestBody.skip_gk = true
    if (config.beforeSend && typeof config.beforeSend === 'function')
      requestBody = config.beforeSend(requestBody) || requestBody
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    if (abort.stopped) return null
    return res.text()
  }

  const runActions = async (actions, abort) => {
    const caps = await capabilities
    const msgs = []
    for (const action of actions) {
      if (abort.stopped) return
      const cap = caps[action.name]
      if (!cap) { console.error(`Unknown capability: ${action.name}`); continue }
      const out = await cap.run(action.args, canvasElement)
      if (out.result) msgs.push(`(${action.name}) ${out.result}`)
      if (!out.continue) break
    }
    if (!msgs.length || abort.stopped) return
    const content = msgs.join('\n')
    history.push({ role: 'user', content, hidden: true, time: Date.now() })
    saveHistory()
    const bubblePromise = addPendingBubble(500)
    const raw = await callLLM(abort, true)
    if (raw === null) { bubblePromise.cancel(); return }
    const bubble = await bubblePromise
    const parsed = parseActions(raw)
    await typewriteInBubble(bubble, parsed.text, abort)
    history.push({ role: 'assistant', content: parsed.text, time: Date.now() })
    saveHistory()
    if (parsed.actions.length) await runActions(parsed.actions, abort)
  }

  const askAndProcess = async (abort) => {
    const bubblePromise = addPendingBubble(1500)
    try {
      const raw = await callLLM(abort, false)
      if (raw === null) { bubblePromise.cancel(); return }
      const bubble = await bubblePromise
      const parsed = parseActions(raw)
      await typewriteInBubble(bubble, parsed.text, abort)
      history.push({ role: 'assistant', content: parsed.text, time: Date.now() })
      saveHistory()
      if (parsed.actions.length) await runActions(parsed.actions, abort)
    } catch (e) {
      bubblePromise.cancel()
      throw e
    }
  }

  let sendAbort = null

  const addGhostBubble = () => {
    const row = document.createElement('div')
    row.id = 'ghost-row'
    row.className = `msg-row user ghost-row${lastMsgRole === 'user' ? ' grouped' : ''}`

    const bubble = document.createElement('div')
    bubble.id = 'ghost-bubble'
    bubble.className = 'chat-msg user ghost-input'
    bubble.contentEditable = 'true'

    const btn = document.createElement('button')
    btn.id = 'ghost-send'
    btn.className = 'ghost-send-btn'
    btn.innerHTML = `Send <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>`

    row.appendChild(bubble)
    row.appendChild(btn)
    appendMsg(row)

    bubble.addEventListener('input', () => {
      bubble.dir = getTextDirection(bubble.innerText)
      messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' })
    })
    bubble.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
    })
    btn.onclick = sendMsg

    setTimeout(() => messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' }), 100)
    if (!('ontouchstart' in window)) bubble.focus()
  }

  const sendMsg = async () => {
    const ghostRow = document.getElementById('ghost-row')
    const ghostBubble = document.getElementById('ghost-bubble')
    if (!ghostBubble) return
    const text = ghostBubble.innerText.trim()
    if (!text) return

    if (greetingAbort) { greetingAbort.stopped = true; greetingAbort = null }

    // Transform ghost → opaque sent message
    ghostBubble.contentEditable = 'false'
    ghostBubble.innerHTML = parseMarkdown(text)
    ghostBubble.dir = getTextDirection(text)
    ghostBubble.classList.remove('ghost-input')
    ghostBubble.style.animation = 'none'
    ghostBubble.style.opacity = '1'

    // Replace send button with timestamp
    const d = new Date()
    const minuteKey = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    const ts = document.createElement('span')
    ts.className = 'chat-timestamp'
    ts.textContent = minuteKey
    document.getElementById('ghost-send').replaceWith(ts)
    ghostRow.classList.remove('ghost-row')
    ghostRow.id = ''
    ghostBubble.id = ''

    lastMsgRole = 'user'
    lastMsgMinute = minuteKey
    history.push({ role: 'user', content: text, time: Date.now() })
    saveHistory()
    const spacer = document.getElementById('scroll-spacer')
    const gap = messages.clientHeight - ghostRow.offsetHeight - 80
    spacer.style.minHeight = Math.max(0, gap) + 'px'
    requestAnimationFrame(() => {
      messages.scrollTo({ top: ghostRow.offsetTop - 80, behavior: 'smooth' })
    })

    const abort = { stopped: false }
    sendAbort = abort

    try {
      await askAndProcess(abort)
    } catch (e) {
      if (abort.stopped) return
      addMsg('Unable to connect to service', 'bot')
    }

    sendAbort = null
    if (!abort.stopped) addGhostBubble()
  }

  clearItem.onclick = async () => {
    menuOpen = false; dropdown.style.display = 'none'
    if (greetingAbort) { greetingAbort.stopped = true; greetingAbort = null }
    if (sendAbort) { sendAbort.stopped = true; sendAbort = null }
    messages.innerHTML = ''
    history.length = 0
    lastMsgRole = null; lastMsgMinute = null
    sessionStorage.removeItem(STORAGE_KEY)
    await playGreeting()
    addGhostBubble()
  }

  widget.style.display = 'block'
  if (!restoreHistory()) {
    playGreeting().then(() => addGhostBubble())
  } else {
    addGhostBubble()
  }
})()

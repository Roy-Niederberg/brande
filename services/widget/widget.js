(function() {
  // Inject stylesheet (URL derived from this script's src)
  const _scriptSrc = document.currentScript?.src
  const _link = document.createElement('link')
  _link.rel = 'stylesheet'
  _link.href = _scriptSrc ? _scriptSrc.replace(/\.js([?#].*)?$/, '.css') : '/widget.css'
  document.head.appendChild(_link)

  // Read global configuration
  const config = window.ChatWidgetConfig || {}
  // Floating mode (launcher bubble + minimize) when no targetElement is supplied.
  const floating = !config.targetElement
  const targetElement = floating
    ? document.body
    : (typeof config.targetElement === 'string'
        ? document.querySelector(config.targetElement)
        : config.targetElement)
  const canvasElement = config.canvasElement
    ? (typeof config.canvasElement === 'string'
        ? document.querySelector(config.canvasElement)
        : config.canvasElement)
    : null
  const API = config.apiEndpoint || '/prompt-composer/ask'
  const STORAGE_KEY = 'chat_history'
  const CONV_KEY = 'chat_conversation_id'
  // Conversation id: sent with every /ask so the prompt-composer can follow and
  // log a conversation (widget analog of Facebook's conversation/thread ids).
  // Lives in sessionStorage next to chat_history — same lifetime as the history.
  let conversationId = ''
  const startConversation = (fresh) => {
    try { if (!fresh) conversationId = sessionStorage.getItem(CONV_KEY) || '' } catch {}
    if (fresh || !conversationId)
      conversationId = crypto.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    try { sessionStorage.setItem(CONV_KEY, conversationId) } catch {}
  }
  const history = []
  let lastMsgRole = null
  let lastMsgMinute = null
  const siteDir = config.direction || 'ltr'
  const rtl = siteDir === 'rtl'
  // In floating mode, targetElement is the host's <body>; don't flip the
  // entire host page's direction — set dir on the widget itself instead.
  if (!floating) targetElement.dir = siteDir
  const capabilities = import('/prompt-composer/capabilities')
    .then(m => m.default || {}).catch(() => ({}))

  const parseActions = (text) => {
    if (!text.includes('|| ACTIONS')) return { text, actions: [] }
    const actions = []
    const kept = []
    for (const l of text.split('\n')) {
      if (l.startsWith('|| ACTIONS')) continue
      if (l.startsWith('|| ')) {
        const parts = l.slice(3).split(' ')
        actions.push({ name: parts[0], args: parts.slice(1).join(' ') })
      } else kept.push(l)
    }
    const cleanText = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    return { text: cleanText, actions }
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

  const legal = rtl
    ? `Qabû AI עלול לטעות — תמיד יש לאמת מידע חשוב מול איש מקצוע מוסמך.
        <a href="https://qabu.net/privacy" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות</a> &middot;
        השימוש בצ'אט מהווה הסכמה ל<a href="https://qabu.net/terms" target="_blank" rel="noopener noreferrer">תנאי השימוש</a>.`
    : `Qabû AI can make mistakes — always verify important information with a qualified professional.
        <a href="https://qabu.net/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> &middot;
        By using this chat you agree to our <a href="https://qabu.net/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.`

  const html = `
    <div id="chat-box">
      <div id="chat-header">
        <div class="chat-header-avatar">
          ${config.profilePic ? `<img src="${config.profilePic}" onerror="this.style.display='none';this.nextElementSibling.style.display=''">` : ''}
          <svg ${config.profilePic ? 'style="display:none"' : ''} width="22" height="22" viewBox="-603 -603 1206 1206">
            <path transform="rotate(135) scale(1)" fill="#1B4F72" d="M -43.934 -600L -43.934 0C -102.948 -160.66 -102.944 -248.528 -175.736 -175.736A 248.528 248.528 0 1 0 43.934 -244.614L 43.934 -804.594C 87.868 -512.132 248.528 -600 424.264 -424.264A 600 600 0 1 1 -43.934 -600"></path>
          </svg>
        </div>
        <div class="chat-header-name">
          <span>${config.clientName || 'Qab\u00fb'}</span>
          <span class="chat-header-status">Qab\u00fb AI &middot; ${rtl ? '\u05e4\u05e2\u05d9\u05dc \u05e2\u05db\u05e9\u05d9\u05d5' : 'Active now'}</span>
        </div>
        ${floating ? `<button class="chat-header-menu-btn" id="chat-minimize-btn" title="Minimize" aria-label="Minimize">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>` : ''}
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
          <div class="chat-theme-row" id="chat-theme-row">
            <button class="chat-theme-btn" data-theme="light" title="Light">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
            <button class="chat-theme-btn" data-theme="system" title="System">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </button>
            <button class="chat-theme-btn" data-theme="dark" title="Dark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div id="chat-messages">
      </div>
      <div id="chat-input-bar">
        <div id="chat-input" contenteditable="true" data-placeholder="${rtl ? 'כתוב הודעה...' : 'Type a message...'}"></div>
        <button id="chat-send" aria-label="Send" title="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div id="chat-footer">${legal}</div>
    </div>
  `

  const widget = document.createElement('div')
  widget.id = 'chat-widget'
  widget.style.fontFamily = fontFamilyCSS
  widget.innerHTML = html

  if (floating) { widget.classList.add('floating'); widget.dir = siteDir }
  targetElement.appendChild(widget)

  const messages = document.getElementById('chat-messages')
  const input = document.getElementById('chat-input')
  const sendBtn = document.getElementById('chat-send')
  const menuBtn = document.getElementById('chat-menu-btn')
  const dropdown = document.getElementById('chat-dropdown')
  const clearItem = document.getElementById('chat-clear-item')

  const scrollToBottom = (d = 0) => {
    const f = () => messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' })
    if (d) setTimeout(f, d)
    else f()
  }

  // Mobile keyboards overlay the layout viewport instead of resizing it, and the
  // browser then pans the page to reveal the caret — exposing blank space past the
  // document edge below the input bar. While the keyboard is up, pin the widget to
  // the visual viewport so the input bar sits directly on the keyboard. Only when
  // the widget spans the full viewport (embedded page / fullscreen floating);
  // scale guard skips pinch-zoom, and kb ≈ 0 wherever the layout viewport already
  // resizes with the keyboard (e.g. interactive-widget=resizes-content).
  const vv = window.visualViewport
  if (vv) {
    const fitViewport = () => {
      const kb = document.documentElement.clientHeight - vv.height
      const fullscreen = !floating || window.innerWidth <= 480
      if (fullscreen && kb > 150 && vv.scale < 1.02) {
        widget.style.height = `${vv.height}px`
        widget.style.transform = `translateY(${vv.offsetTop}px)`
      } else {
        widget.style.height = ''
        widget.style.transform = ''
      }
      scrollToBottom()
    }
    vv.addEventListener('resize', fitViewport)
    vv.addEventListener('scroll', fitViewport)
  }

  const applyMetadata = (row, role, time) => {
    const d = time ? new Date(time) : new Date()
    const minuteKey = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    const isGrouped = role === lastMsgRole
    if (isGrouped) row.classList.add('grouped')

    if (!isGrouped || minuteKey !== lastMsgMinute) {
      const ts = document.createElement('span')
      ts.className = 'chat-timestamp'
      ts.textContent = minuteKey
      row.appendChild(ts)
    }
    lastMsgRole = role
    lastMsgMinute = minuteKey
  }

  let menuOpen = false
  menuBtn.onclick = (e) => { e.stopPropagation(); menuOpen = !menuOpen; dropdown.style.display = menuOpen ? 'block' : 'none' }
  document.addEventListener('click', () => { if (menuOpen) { menuOpen = false; dropdown.style.display = 'none' } })

  const THEME_KEY = 'chat_theme'
  const applyTheme = (t) => {
    widget.removeAttribute('data-theme')
    if (t === 'light' || t === 'dark') widget.setAttribute('data-theme', t)
    document.querySelectorAll('.chat-theme-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === t))
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'system')
  document.getElementById('chat-theme-row').onclick = (e) => {
    const btn = e.target.closest('.chat-theme-btn')
    if (!btn) return
    const t = btn.dataset.theme
    localStorage.setItem(THEME_KEY, t)
    applyTheme(t)
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
    if (!cleanText.trim()) return siteDir // Default to site direction if only numbers/symbols

    const hebrewCount = (cleanText.match(/[\u0590-\u05FF]/g) || []).length
    const totalCount = cleanText.length

    // If significant portion (>30%) of remaining text is Hebrew, assume RTL
    return (hebrewCount / totalCount) > 0.3 ? 'rtl' : 'ltr'
  }

  let restoring = false

  const addMsg = (content, role, time) => {
    const uiRole = role === 'assistant' ? 'bot' : role
    const row = document.createElement('div')
    row.className = `msg-row ${uiRole}`

    const msg = document.createElement('div')
    msg.className = `chat-msg ${uiRole}`
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
    applyMetadata(row, role, time)

    messages.appendChild(row)
    scrollToBottom(100)
  }

  const addPendingBubble = (delay = 500) => {
    let timeoutId
    const promise = new Promise(resolve => {
      timeoutId = setTimeout(() => {
        const row = document.createElement('div')
        row.className = 'msg-row bot'
        const msg = document.createElement('div')
        msg.className = 'chat-msg bot'
        msg.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>'
        msg._showTime = Date.now()
        row.appendChild(msg)
        applyMetadata(row, 'assistant')
        messages.appendChild(row)
        scrollToBottom(100)
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
        const d = token.value === '<br>' ? 180
          : !token.visible ? 0
          : token.value === ' ' ? 30
          : token.value === ',' ? 100
          : token.value === '.' ? 180
          : 10
        if (d) await new Promise(r => setTimeout(r, d))
        if (token.value === '<br>') scrollToBottom()
      }
      scrollToBottom()
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
        if (!entry.hidden) addMsg(entry.content, entry.role, entry.time)
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
    let requestBody = { mod: 'widget', conversation_id: conversationId, chat,
      local_time: new Date().toLocaleString() }
    if (skipGk) requestBody.skip_gk = true
    if (config.beforeSend && typeof config.beforeSend === 'function')
      requestBody = config.beforeSend(requestBody) || requestBody
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    if (abort.stopped) return null
    if (!res.ok) throw new Error(res.status)
    if (res.status === 204) return null // gatekeeper ignored — callers treat null as "show nothing"
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
    const bubblePromise = addPendingBubble(1800)
    try {
      const raw = await callLLM(abort, false)
      if (raw === null) { bubblePromise.cancel(); return }
      const bubble = await bubblePromise
      const dotsElapsed = Date.now() - bubble._showTime
      const dotsRemaining = Math.max(0, 3000 - dotsElapsed)
      if (!abort.stopped && dotsRemaining) await new Promise(r => setTimeout(r, dotsRemaining))
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

  const sendMsg = async () => {
    if (sendAbort) return
    const text = input.innerText.trim()
    if (!text) return

    if (greetingAbort) { greetingAbort.stopped = true; greetingAbort = null }

    input.innerHTML = ''
    input.dir = siteDir
    addMsg(text, 'user')
    history.push({ role: 'user', content: text, time: Date.now() })
    saveHistory()

    sendBtn.disabled = true
    const abort = { stopped: false }
    sendAbort = abort

    try {
      await askAndProcess(abort)
    } catch (e) {
      if (!abort.stopped) addMsg('Unable to connect to service', 'assistant')
    }

    sendBtn.disabled = false
    if (sendAbort === abort) sendAbort = null
  }

  input.addEventListener('input', () => {
    if (input.innerHTML === '<br>') input.innerHTML = '' // keep :empty placeholder working
    input.dir = input.innerText.trim() ? getTextDirection(input.innerText) : siteDir
    scrollToBottom()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  })
  sendBtn.onclick = sendMsg
  const focusInput = () => { if (!('ontouchstart' in window)) input.focus() }

  clearItem.onclick = async () => {
    menuOpen = false; dropdown.style.display = 'none'
    if (greetingAbort) { greetingAbort.stopped = true; greetingAbort = null }
    if (sendAbort) { sendAbort.stopped = true; sendAbort = null }
    messages.innerHTML = ''
    sendBtn.disabled = false
    history.length = 0
    lastMsgRole = null; lastMsgMinute = null
    sessionStorage.removeItem(STORAGE_KEY)
    startConversation(true)
    await playGreeting()
    focusInput()
  }

  const hasHistory = restoreHistory()
  startConversation(!hasHistory)

  if (floating) {
    const launcher = document.createElement('button')
    launcher.id = 'chat-launcher'
    launcher.dir = siteDir
    launcher.setAttribute('aria-label', 'Open chat')
    launcher.innerHTML = `<svg width="28" height="28" viewBox="-603 -603 1206 1206" fill="white"><path transform="rotate(135)" d="M -43.934 -600 L -43.934 0 C -102.948 -160.66 -102.944 -248.528 -175.736 -175.736 A 248.528 248.528 0 1 0 43.934 -244.614 L 43.934 -804.594 C 87.868 -512.132 248.528 -600 424.264 -424.264 A 600 600 0 1 1 -43.934 -600"/></svg>`
    document.body.appendChild(launcher)
    document.getElementById('chat-minimize-btn').onclick = () => {
      widget.classList.remove('open'); launcher.classList.add('show')
    }
    // Defer the greeting until first open — playing into a hidden widget
    // means users miss the typewriter animation.
    let firstOpen = true
    launcher.onclick = async () => {
      widget.classList.add('open'); launcher.classList.remove('show')
      if (firstOpen) {
        firstOpen = false
        if (!hasHistory) await playGreeting()
      }
      focusInput()
    }
    requestAnimationFrame(() => launcher.classList.add('show'))
  } else {
    widget.style.display = 'block'
    if (!hasHistory) playGreeting().then(focusInput)
    else focusInput()
  }
})()

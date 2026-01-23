(function() {
  // Read global configuration
  const config = window.ChatWidgetConfig || {}
  const targetElement = config.targetElement
    ? (typeof config.targetElement === 'string'
        ? document.querySelector(config.targetElement)
        : config.targetElement)
    : document.body // Default to body if not specified
  targetElement.dir ='ltr'
  const API = config.apiEndpoint || '/widget-api/ask'
  const history = []
  let messageCount = 0

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
    @keyframes bounce {
      0%, 100% {
        opacity: 0.5;
        transform: translateY(0);
      }
      50% {
        opacity: 1;
        transform: translateY(-6px);
      }
    }

    #chat-widget {
      position: relative;
      width: 100%;
      height: 100%;
      animation: none;
      z-index: 1;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    }

    #chat-box {
      display: flex;
      flex-direction: column;
      gap: 0;
      backdrop-filter: blur(10px) saturate(180%);
      -webkit-backdrop-filter: blur(10px) saturate(180%);
      background-color: rgba(0, 0, 0, 0.2);
      padding: 0;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.03);
      height: 100%;
    }

    #chat-header {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: flex-start;
      gap: 10px;
      margin: 0;
      padding: 10px 20px 0;
      z-index: 10;
      pointer-events: none;
      box-sizing: border-box;
    }

    .chat-header-btn {
      position: relative;
      background: rgba(50, 118, 170, 0.85);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
      font-size: 23px;
      overflow: hidden;
      pointer-events: auto;
    }
    .chat-header-btn:hover {
      background: rgba(0,0,0,0.08);
      transform: scale(1.15) rotate(5deg);
    }
    .chat-header-btn:active {
      transform: scale(0.9);
    }

    #chat-messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px;
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

    .chat-msg {
      padding: 18px 22px;
      padding-bottom: 24px;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
      position: relative;
      font-size: 20px;
      line-height: 1.5;
      pointer-events: auto;
      opacity: 0;
      animation: slideInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      will-change: transform, opacity;
      white-space: pre-wrap; /* Preserve newlines */
    }

    .chat-timestamp {
      position: absolute;
      bottom: 6px;
      right: 12px;
      font-size: 13px;
      opacity: 0.5;
      pointer-events: none;
    }

    .chat-msg.user {
      background: #A6D0DD;
      color: #0F2C59;
      align-self: flex-end;
      text-align: start;
      border: 1px solid rgba(0,0,0,0.06);
      margin-right: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05);
    }

    .chat-msg.bot {
      background: #0F2C59;
      color: #ffffff;
      align-self: flex-start;
      margin-left: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
    }

    .chat-tail {
      position: absolute;
      top: 14px;
      width: 12px;
      height: 12px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    .chat-tail.user { right: -10px; }
    .chat-tail.bot { left: -10px; }

    #typing-indicator {
      padding: 14px 20px;
      border-radius: 18px;
      background: #0F2C59;
      margin-left: 12px;
      width: auto;
      align-self: flex-start;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
      animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .typing-dots {
      display: flex;
      gap: 5px;
      align-items: center;
      justify-content: center;
      height: 20px;
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: white;
      animation: bounce 1.4s infinite ease-in-out;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    .typing-dot:nth-child(3) { animation-delay: 0s; }

    #chat-input-area {
      display: flex;
      gap: 10px;
      position: relative;
      padding: 20px;
      flex-shrink: 0;
      align-items: flex-end; /* Align bottom so input grows up */
    }

    #chat-input {
      flex: 1;
      padding: 16px 22px;
      border: 2px solid #A6D0DD;
      border-radius: 24px;
      outline: none;
      font-size: 21px;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      pointer-events: auto;
      user-select: text;
      -webkit-user-select: text;
      transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
      resize: none; /* Disable manual resize */
      overflow-y: hidden; /* Hide scrollbar initially */
      min-height: 32px; /* Approximate height for 1 line */
      line-height: 1.5;
      box-sizing: border-box;
    }
    #chat-input:focus {
      border-color: #3276AA;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 3px rgba(50, 118, 170, 0.3);
    }
    #chat-input::placeholder {
      color: #94a3b8;
    }

    #chat-send {
      background: #3276AA;
      color: white;
      border: none;
      height: 68px;
      width: 68px;
      border-radius: 34px; /* Half of height for perfect circle */
      cursor: pointer;
      font-weight: 600;
      font-size: 19px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      display: flex; /* Use flex to center SVG */
      align-items: center;
      justify-content: center;
      padding: 0; /* Remove padding as width/height are explicit */
    }
    #chat-send::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    #chat-send:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 20px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.15);
    }
    #chat-send:active {
      transform: translateY(0) scale(0.98);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    #chat-send:active::before {
      width: 300px;
      height: 300px;
      transition: width 0s, height 0s;
    }
    #chat-send:disabled {
      cursor: not-allowed;
    }
  `

  const html = `
    <div id="chat-box">
      <div id="chat-header">
        <button class="chat-header-btn" id="chat-close" title="Clear History">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
      <div id="chat-messages">
        <div id="typing-indicator">
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
      <div id="chat-input-area">
        <textarea id="chat-input" rows="1" placeholder="Type your message..."></textarea>
        <button id="chat-send">
          <svg width="48" height="48" viewBox="-603 -603 1206 1206">
            <path transform="rotate(135) scale(1)" fill="#ffff" d="M -43.934 -600L -43.934 0C -102.948 -160.66 -102.944 -248.528 -175.736 -175.736A 248.528 248.528 0 1 0 43.934 -244.614L 43.934 -804.594C 87.868 -512.132 248.528 -600 424.264 -424.264A 600 600 0 1 1 -43.934 -600"/>
          </svg>
        </button>
      </div>
    </div>
  `

  setTimeout(() => {
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

    const input = document.getElementById('chat-input')
    const send = document.getElementById('chat-send')
    const messages = document.getElementById('chat-messages')
    const closeBtn = document.getElementById('chat-close')
    const typingIndicator = document.getElementById('typing-indicator')

    const parseMarkdown = (text) => {
      let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic sanitization
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/^\s*[\*\-]\s+(.*)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
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

    const addMsg = (content, role) => {
      const msg = document.createElement('div')
      msg.className = `chat-msg ${role}`
      msg.innerHTML = parseMarkdown(content)
      msg.dir = getTextDirection(content) // Set text direction
      msg.style.animationDelay = `${messageCount * 0.05}s`
      messageCount++

      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const timestamp = document.createElement('span')
      timestamp.className = 'chat-timestamp'
      timestamp.textContent = `${hours}:${minutes}`

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', `chat-tail ${role}`)
      svg.setAttribute('viewBox', '0 0 12 12')
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      if (role === 'user') {
        path.setAttribute('d', 'M 0 0 L 12 6 L 0 12 Z')
        path.setAttribute('fill', '#A6D0DD')
        path.setAttribute('stroke', 'rgba(0,0,0,0.06)')
        path.setAttribute('stroke-width', '0.5')
      } else {
        path.setAttribute('d', 'M 12 0 L 0 6 L 12 12 Z')
        path.setAttribute('fill', '#0F2C59')
        path.setAttribute('stroke', 'none')
      }

      svg.appendChild(path)
      msg.appendChild(svg)
      msg.appendChild(timestamp)
      messages.appendChild(msg)

      // Smooth scroll to new message
      setTimeout(() => {
        messages.scrollTo({
          top: messages.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }

    const showTyping = () => {
      messages.appendChild(typingIndicator)
      typingIndicator.style.display = 'flex'
      setTimeout(() => {
        messages.scrollTo({
          top: messages.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }

    const hideTyping = () => {
      typingIndicator.style.display = 'none'
    }

    // Auto-resize textarea
    const adjustHeight = () => {
      input.style.height = 'auto'
      const maxHeight = document.getElementById('chat-box').clientHeight * 0.7
      // scrollHeight includes padding but not border. box-sizing is border-box.
      // We need to add total border width (2px top + 2px bottom = 4px)
      const borderHeight = 4
      const newHeight = Math.min(input.scrollHeight + borderHeight, maxHeight)
      input.style.height = newHeight + 'px'
      input.style.overflowY = input.scrollHeight + borderHeight > maxHeight ? 'auto' : 'hidden'
    }

    input.addEventListener('input', () => {
      adjustHeight()
      input.dir = getTextDirection(input.value)
    })
    // Initial adjustment
    adjustHeight()

    const sendMsg = async () => {
      const text = input.value.trim()
      if (!text) return

      addMsg(text, 'user')
      history.push({ role: 'user', content: text })
      input.value = ''
      input.dir = 'ltr'
      adjustHeight() // Reset height correctly
      send.disabled = true
      input.disabled = true

      setTimeout(async () => {
        showTyping()

        try {
          const chat_history = history.map(h => `${h.role === 'user' ? '<<<USER>>>: ' : '<<<ASSISTANT>>>: '}${h.content}`).join('\n')
          let requestBody = { module: 'widget', chat_data: { chat_history } }

          // Allow config to modify request body before sending
          if (config.beforeSend && typeof config.beforeSend === 'function') {
            requestBody = config.beforeSend(requestBody) || requestBody
          }

          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })
          const reply = await res.text()
          hideTyping()
          addMsg(reply, 'bot')
          history.push({ role: 'assistant', content: reply })
        } catch (e) {
          hideTyping()
          addMsg('Unable to connect to service', 'bot')
        }
        send.disabled = false
        input.disabled = false
        input.focus()
      }, 600)
    }

    send.onclick = sendMsg

    // Handle Enter vs Shift+Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!e.shiftKey) {
          e.preventDefault()
          if (!input.disabled) sendMsg()
        }
        // Shift+Enter allows default behavior (new line)
      }
    })

    closeBtn.onclick = () => {
      // Clear the chat
      messages.innerHTML = ''
      messages.appendChild(typingIndicator)
      history.length = 0
      messageCount = 0
    }

    // Initial visibility
    widget.style.display = 'block'
  }, 0)
})()

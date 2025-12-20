(function() {
  const API = window.location.origin + '/widget-api/ask';

  // Detect if page is RTL
  const isRTL = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';

  // State management
  const state = {
    history: [],
    messageCount: 0,
    isRTL: isRTL,
    isMinimized: false
  };

  // Detect text direction based on content
  function detectTextDirection(text) {
    const hebrewPattern = /[\u0590-\u05FF]/g;
    const hebrewChars = (text.match(hebrewPattern) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    return hebrewChars / totalChars > 0.3 ? 'rtl' : 'ltr';
  }

  // Auto-resize textarea
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }

  // Simple markdown parser
  function parseMarkdown(text) {
    // Process bold and italic first (before bullet lists to avoid conflicts)
    let html = text
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Code: `text`
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Links: [text](url)
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Process bullet lists (lines starting with * or -)
    const lines = html.split('\n');
    let inList = false;
    const processed = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^[\*\-]\s+(.+)$/);

      if (bulletMatch) {
        if (!inList) {
          processed.push('<ul>');
          inList = true;
        }
        processed.push(`<li>${bulletMatch[1]}</li>`);
      } else {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        processed.push(line);
      }
    }

    if (inList) {
      processed.push('</ul>');
    }

    return processed.join('\n')
      // Italic: *text* or _text_ (after bullet processing to avoid conflicts)
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Line breaks (skip inside lists)
      .replace(/\n(?![<\/]?[ul|li])/g, '<br>');
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
    @keyframes slideInFromSide {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    @keyframes slideOutToSide {
      to {
        transform: translateX(100%);
      }
    }
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
        transform: translateY(5px);
      }
    }
    @keyframes scaleIn {
      0% {
        opacity: 0;
        transform: scale(0.5);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }
      50% {
        transform: scale(1.03);
        box-shadow: 0 6px 25px rgba(0,0,0,0.15);
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
    @keyframes ripple {
      to {
        transform: scale(2);
        opacity: 0;
      }
    }

    #chat-widget {
      position: fixed;
      top: 0;
      bottom: 0;
      right: 0;
      width: 400px;
      max-width: 100vw;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideInFromSide 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      direction: ltr;
    }

    @media (max-width: 768px) {
      #chat-widget {
        width: 100vw;
        height: 100dvh;
        left: 0;
        right: 0;
        overscroll-behavior: contain;
        touch-action: pan-y;
      }

      body.chat-open {
        overflow: hidden;
        position: fixed;
        width: 100%;
        height: 100dvh;
      }
    }
    #chat-widget.hiding {
      animation: slideOutToSide 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    #chat-box {
      display: flex;
      flex-direction: column;
      gap: 0;
      backdrop-filter: blur(2px) saturate(180%);
      -webkit-backdrop-filter: blur(2px) saturate(180%);
      background-color: rgba(0, 0, 0, 0.2);
      padding: 0;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.03);
      height: 100%;
    }

    @media (max-width: 768px) {
      #chat-box {
        height: 100dvh;
      }
    }

    #chat-header {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin: 0;
      padding: 10px 20px 0;
      flex-shrink: 0;
      direction: ltr;
    }

    @media (max-width: 768px) {
      #chat-header {
        padding: max(10px, env(safe-area-inset-top)) 12px 0;
      }
    }

    .chat-header-btn {
      position: relative;
      background: rgba(0,0,0,0.60);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: #4fff;
      font-size: 18px;
      overflow: hidden;
    }
    .chat-header-btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(0,0,0,0.1);
      transform: translate(-50%, -50%);
      transition: width 0.3s, height 0.3s;
    }
    .chat-header-btn:hover {
      background: rgba(0,0,0,0.08);
      transform: scale(1.15) rotate(5deg);
    }
    .chat-header-btn:active::before {
      width: 100%;
      height: 100%;
      transition: width 0.1s, height 0.1s;
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

    @media (max-width: 768px) {
      #chat-messages {
        padding: 12px;
      }
    }
    #chat-messages::-webkit-scrollbar { width: 6px; }
    #chat-messages::-webkit-scrollbar-track { background: transparent; }
    #chat-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    #chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }

    .chat-msg {
      padding: 8px 12px;
      padding-bottom: 20px;
      max-width: 65%;
      min-width: 80px;
      word-wrap: break-word;
      position: relative;
      font-size: 14px;
      line-height: 1.5;
      pointer-events: auto;
      opacity: 0;
      animation: slideInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      will-change: transform, opacity;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .chat-timestamp {
      position: absolute;
      bottom: 4px;
      right: 12px;
      font-size: 11px;
      color: #888;
      margin-top: 4px;
      text-align: right;
      pointer-events: none;
    }

    .chat-msg.user {
      background: #dcf8c6;
      color: #1a1a1a;
      align-self: flex-end;
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 8px 8px 2px 8px;
    }

    .chat-msg.bot {
      background: white;
      color: #1a1a1a;
      align-self: flex-start;
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 8px 8px 8px 2px;
    }

    .chat-msg strong {
      font-weight: 600;
    }

    .chat-msg em {
      font-style: italic;
    }

    .chat-msg code {
      background: rgba(0,0,0,0.08);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 13px;
    }

    .chat-msg a {
      color: #0066cc;
      text-decoration: underline;
    }

    .chat-msg a:hover {
      color: #0052a3;
    }

    .chat-msg ul {
      margin: 4px 0;
      padding-left: 20px;
      list-style-type: disc;
    }

    .chat-msg li {
      margin: 2px 0;
      line-height: 1.4;
    }

    #typing-indicator {
      padding: 14px 20px;
      border-radius: 18px;
      background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
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
      background: #94a3b8;
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
      direction: ltr;
    }

    @media (max-width: 768px) {
      #chat-input-area {
        padding: 12px;
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }
    }

    #chat-input {
      flex: 1;
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 20px;
      outline: none;
      font-size: 16px;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      pointer-events: auto;
      user-select: text;
      -webkit-user-select: text;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
      resize: none;
      max-height: 100px;
      overflow-y: auto;
      line-height: 1.5;
    }
    #chat-input:focus {
      border-color: #667eea;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 3px rgba(102,126,234,0.1);
    }
    #chat-input::placeholder {
      color: #94a3b8;
    }

    #chat-send {
      background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
      color: white;
      border: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
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

    #chat-reopen {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 28px;
      width: 64px;
      height: 64px;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1);
      z-index: 9999;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      transform: scale(0.5) rotate(-180deg);
    }
    #chat-reopen.show {
      opacity: 1;
      transform: scale(1) rotate(0deg);
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    #chat-reopen:hover {
      transform: scale(1.1) rotate(5deg);
      box-shadow: 0 12px 32px rgba(0,0,0,0.25), 0 8px 16px rgba(0,0,0,0.15);
    }
    #chat-reopen:active {
      transform: scale(0.95);
    }
  `;

  const html = `
    <div id="chat-box">
      <div id="chat-header">
        <button class="chat-header-btn" id="chat-minimize" title="${isRTL ? 'מזער' : 'Minimize'}">−</button>
        <button class="chat-header-btn" id="chat-close" title="${isRTL ? 'סגור ונקה' : 'Close & Clear'}">×</button>
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
        <textarea id="chat-input" rows="1" placeholder="${isRTL ? 'הקלד הודעה...' : 'Type your message...'}"></textarea>
        <button id="chat-send">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  setTimeout(() => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'chat-widget';
    widget.innerHTML = html;
    document.body.appendChild(widget);

    const reopenBtn = document.createElement('button');
    reopenBtn.id = 'chat-reopen';
    reopenBtn.textContent = '💬';
    reopenBtn.title = isRTL ? 'פתח צ\'אט' : 'Open chat';
    document.body.appendChild(reopenBtn);

    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const messages = document.getElementById('chat-messages');
    const chatBox = document.getElementById('chat-box');
    const minimizeBtn = document.getElementById('chat-minimize');
    const closeBtn = document.getElementById('chat-close');
    const typingIndicator = document.getElementById('typing-indicator');

    const addMsg = (content, role) => {
      const msg = document.createElement('div');
      msg.className = `chat-msg ${role}`;
      msg.style.animationDelay = `${state.messageCount * 0.05}s`;
      msg.style.direction = detectTextDirection(content);
      state.messageCount++;

      // Create message text element with markdown parsing
      const textDiv = document.createElement('div');
      textDiv.innerHTML = parseMarkdown(content);

      // Create timestamp
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timestamp = document.createElement('span');
      timestamp.className = 'chat-timestamp';
      timestamp.textContent = `${hours}:${minutes}`;

      msg.appendChild(textDiv);
      msg.appendChild(timestamp);
      messages.appendChild(msg);

      // Smooth scroll to new message
      setTimeout(() => {
        messages.scrollTo({
          top: messages.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    };

    addMsg(isRTL ? 'צריכים עזרה?' : 'Need help?', 'bot');

    const showTyping = () => {
      messages.appendChild(typingIndicator);
      typingIndicator.style.display = 'flex';
      setTimeout(() => {
        messages.scrollTo({
          top: messages.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    };

    const hideTyping = () => {
      typingIndicator.style.display = 'none';
    };

    const sendMsg = async () => {
      const text = input.value.trim();
      if (!text) return;

      addMsg(text, 'user');
      state.history.push({ role: 'user', content: text });

      // Reset textarea
      input.value = '';
      input.style.height = 'auto';
      input.style.direction = 'ltr';
      send.disabled = true;

      setTimeout(async () => {
        showTyping();

        try {
          const chat_history = state.history.map(h => `${h.role === 'user' ? '<<<USER>>>: ' : '<<<ASSISTANT>>>: '}${h.content}`).join('\n') + `\n<<<USER>>>: ${text}\n`;
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module: 'widget', chat_data: { chat_history } })
          });
          const reply = await res.text();
          hideTyping();
          addMsg(reply, 'bot');
          state.history.push({ role: 'assistant', content: reply });
        } catch (e) {
          hideTyping();
          addMsg('Unable to connect to service', 'bot');
        }
        send.disabled = false;
      }, 600);
    };

    send.onclick = sendMsg;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });

    // Set initial direction for placeholder based on page RTL
    input.style.direction = isRTL ? 'rtl' : 'ltr';

    // Auto-resize and direction detection for textarea
    input.addEventListener('input', () => {
      autoResizeTextarea(input);
      if (input.value.trim()) {
        input.style.direction = detectTextDirection(input.value);
      } else {
        // Reset to page direction when empty (for placeholder)
        input.style.direction = isRTL ? 'rtl' : 'ltr';
      }
    });

    minimizeBtn.onclick = () => {
      widget.classList.add('hiding');
      document.body.classList.remove('chat-open');
      setTimeout(() => {
        widget.style.display = 'none';
        widget.classList.remove('hiding');
        reopenBtn.style.display = 'flex';
        setTimeout(() => reopenBtn.classList.add('show'), 10);
      }, 300);
    };

    closeBtn.onclick = () => {
      widget.classList.add('hiding');
      document.body.classList.remove('chat-open');
      setTimeout(() => {
        messages.innerHTML = '';
        messages.appendChild(typingIndicator);
        state.history.length = 0;
        state.messageCount = 0;
        widget.style.display = 'none';
        widget.classList.remove('hiding');
        reopenBtn.style.display = 'flex';
        setTimeout(() => reopenBtn.classList.add('show'), 10);
        addMsg(isRTL ? 'צריכים עזרה?' : 'Need help?', 'bot');
      }, 300);
    };

    reopenBtn.onclick = () => {
      reopenBtn.classList.remove('show');
      setTimeout(() => {
        reopenBtn.style.display = 'none';
        widget.style.display = 'block';
        if (window.innerWidth <= 768) {
          document.body.classList.add('chat-open');
        }
        setTimeout(() => input.focus(), 100);
      }, 300);
    };

    // Minimize when clicking outside the widget
    document.addEventListener('click', (e) => {
      if (widget.style.display !== 'none' && !widget.contains(e.target) && e.target !== reopenBtn) {
        minimizeBtn.click();
      }
    });

    // Start minimized
    widget.style.display = 'none';
    reopenBtn.style.display = 'flex';
    setTimeout(() => reopenBtn.classList.add('show'), 10);
  }, 1000);
})();

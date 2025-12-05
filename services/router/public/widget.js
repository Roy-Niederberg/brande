(function() {
  const API = window.location.origin + '/widget-api/ask';
  const history = [];
  let messageCount = 0;

  // Detect if page is RTL
  const isRTL = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';

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
        transform: ${isRTL ? 'translateX(-100%)' : 'translateX(100%)'};
      }
      to {
        transform: translateX(0);
      }
    }
    @keyframes slideOutToSide {
      to {
        transform: ${isRTL ? 'translateX(-100%)' : 'translateX(100%)'};
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
      ${isRTL ? 'left: 0;' : 'right: 0;'}
      width: 400px;
      max-width: 100vw;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideInFromSide 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #chat-widget.hiding {
      animation: slideOutToSide 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    #chat-box {
      display: flex;
      flex-direction: column;
      gap: 0;
      background: transparent;
      backdrop-filter: none;
      border-radius: 0;
      padding: 0;
      box-shadow: none;
      height: 100%;
    }

    #chat-header {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin: 0;
      padding: 10px 20px 0;
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
      overflow-y: scroll;
      overflow-x: hidden;
      padding: 20px;
      margin: 0;
      scroll-behavior: smooth;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,0.1) transparent;
    }
    #chat-messages::-webkit-scrollbar { width: 6px; }
    #chat-messages::-webkit-scrollbar-track { background: transparent; }
    #chat-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    #chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }

    .chat-msg {
      padding: 14px 18px;
      border-radius: 18px;
      max-width: 80%;
      word-wrap: break-word;
      position: relative;
      font-size: 15px;
      line-height: 1.5;
      pointer-events: auto;
      opacity: 0;
      animation: slideInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      will-change: transform, opacity;
    }

    .chat-msg.user {
      background: #f8f9fa;
      color: #1a1a1a;
      align-self: ${isRTL ? 'flex-start' : 'flex-end'};
      text-align: ${isRTL ? 'left' : 'right'};
      border: 1px solid rgba(0,0,0,0.06);
      margin-right: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05);
    }

    .chat-msg.bot {
      background: #1a202c;
      color: #ffffff;
      align-self: ${isRTL ? 'flex-end' : 'flex-start'};
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
      background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
      margin-left: 12px;
      width: auto;
      align-self: ${isRTL ? 'flex-end' : 'flex-start'};
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
      ${isRTL ? 'direction: rtl;' : ''}
    }

    #chat-input {
      flex: 1;
      padding: 14px 20px;
      border: 2px solid rgba(0,0,0,0.08);
      border-radius: 24px;
      outline: none;
      font-size: 15px;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      pointer-events: auto;
      user-select: text;
      -webkit-user-select: text;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
    }
    #chat-input:focus {
      border-color: rgba(45, 55, 72, 0.3);
      box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 3px rgba(45, 55, 72, 0.05);
      transform: translateY(-1px);
    }
    #chat-input::placeholder {
      color: #94a3b8;
    }

    #chat-send {
      background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 24px;
      cursor: pointer;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
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
      background: linear-gradient(135deg, #cbd5e0 0%, #a0aec0 100%);
      cursor: not-allowed;
      transform: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    #chat-reopen {
      position: fixed;
      bottom: 24px;
      ${isRTL ? 'left: 24px;' : 'right: 24px;'}
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
        <input id="chat-input" type="text" placeholder="${isRTL ? 'הקלד הודעה...' : 'Type your message...'}" />
        <button id="chat-send">${isRTL ? 'שלח' : 'Send'}</button>
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
      msg.textContent = content;
      msg.style.animationDelay = `${messageCount * 0.05}s`;
      messageCount++;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', `chat-tail ${role}`);
      svg.setAttribute('viewBox', '0 0 12 12');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      // Don't flip the SVG - CSS already handles RTL positioning
      if (role === 'user') {
        path.setAttribute('d', 'M 0 0 L 12 6 L 0 12 Z');
        path.setAttribute('fill', '#f8f9fa');
        path.setAttribute('stroke', 'rgba(0,0,0,0.06)');
        path.setAttribute('stroke-width', '0.5');
      } else {
        path.setAttribute('d', 'M 12 0 L 0 6 L 12 12 Z');
        path.setAttribute('fill', '#1a202c');
        path.setAttribute('stroke', 'none');
      }

      svg.appendChild(path);
      msg.appendChild(svg);
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
      history.push({ role: 'user', content: text });
      input.value = '';
      send.disabled = true;

      setTimeout(async () => {
        showTyping();

        try {
          const chat_history = history.map(h => `${h.role === 'user' ? '<<<USER>>>: ' : '<<<ASSISTANT>>>: '}${h.content}`).join('\n') + `\n<<<USER>>>: ${text}\n`;
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module: 'widget', chat_data: { chat_history } })
          });
          const reply = await res.text();
          hideTyping();
          addMsg(reply, 'bot');
          history.push({ role: 'assistant', content: reply });
        } catch (e) {
          hideTyping();
          addMsg('Unable to connect to service', 'bot');
        }
        send.disabled = false;
      }, 600);
    };

    send.onclick = sendMsg;
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMsg();
      }
    });

    minimizeBtn.onclick = () => {
      widget.classList.add('hiding');
      setTimeout(() => {
        widget.style.display = 'none';
        widget.classList.remove('hiding');
        reopenBtn.style.display = 'flex';
        setTimeout(() => reopenBtn.classList.add('show'), 10);
      }, 300);
    };

    closeBtn.onclick = () => {
      widget.classList.add('hiding');
      setTimeout(() => {
        messages.innerHTML = '';
        messages.appendChild(typingIndicator);
        history.length = 0;
        messageCount = 0;
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
        setTimeout(() => input.focus(), 100);
      }, 300);
    };

    // Start minimized
    widget.style.display = 'none';
    reopenBtn.style.display = 'flex';
    setTimeout(() => reopenBtn.classList.add('show'), 10);
  }, 1000);
})();

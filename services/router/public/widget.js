(function() {
  const API = window.location.origin + '/widget-api/ask';
  const history = [];

  // Detect if page is RTL
  const isRTL = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';

  const css = `
    #chat-widget { position: fixed; bottom: 20px; ${isRTL ? 'left: 20px;' : 'right: 20px;'} width: 380px; max-width: 90vw; z-index: 9999; font-family: Arial, sans-serif; }
    #chat-box { display: flex; flex-direction: column; gap: 16px; position: relative; }
    #chat-messages { display: flex; flex-direction: column; gap: 16px; max-height: calc(100vh - 140px); overflow-y: auto; }
    .chat-msg { padding: 16px 20px; border-radius: 12px; max-width: 85%; word-wrap: break-word; position: relative; font-size: 16px; line-height: 1.5; pointer-events: auto; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.15)); }
    .chat-msg.user { background: #fff; color: #000; align-self: ${isRTL ? 'flex-start' : 'flex-end'}; text-align: ${isRTL ? 'left' : 'right'}; border: 1px solid #ddd; margin-right: 12px; }
    .chat-msg.bot { background: #f5f5f5; color: #000; align-self: ${isRTL ? 'flex-end' : 'flex-start'}; border: 1px solid #ddd; margin-left: 12px; }
    .chat-tail { position: absolute; top: 16px; width: 12px; height: 12px; }
    .chat-tail.user { right: -12px; }
    .chat-tail.bot { left: -12px; }
    #chat-input-area { display: flex; gap: 8px; position: relative; z-index: 10; ${isRTL ? 'direction: rtl;' : ''} }
    #chat-input { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 25px; outline: none; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); pointer-events: auto; user-select: text; -webkit-user-select: text; }
    #chat-send { background: #333; color: white; border: 1px solid #555; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    #chat-send:hover { background: #555; }
    #chat-send:disabled { background: #999; cursor: not-allowed; }
  `;

  const html = `
    <div id="chat-box">
      <div id="chat-messages"></div>
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

    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const messages = document.getElementById('chat-messages');

    const addMsg = (content, role) => {
      const msg = document.createElement('div');
      msg.className = `chat-msg ${role}`;
      msg.textContent = content;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', `chat-tail ${role}`);
      svg.setAttribute('viewBox', '0 0 12 12');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      // Don't flip the SVG - CSS already handles RTL positioning
      if (role === 'user') {
        path.setAttribute('d', 'M 0 0 L 12 6 L 0 12 Z');
        path.setAttribute('fill', '#fff');
      } else {
        path.setAttribute('d', 'M 12 0 L 0 6 L 12 12 Z');
        path.setAttribute('fill', '#f5f5f5');
      }
      path.setAttribute('stroke', '#ddd');
      path.setAttribute('stroke-width', '1');

      svg.appendChild(path);
      msg.appendChild(svg);
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    };

    addMsg(isRTL ? 'צריכים עזרה?' : 'Need help?', 'bot');

    const sendMsg = async () => {
      const text = input.value.trim();
      if (!text) return;

      addMsg(text, 'user');
      history.push({ role: 'user', content: text });
      input.value = '';
      send.disabled = true;

      try {
        const chat_history = history.map(h => `${h.role === 'user' ? '<<<USER>>>: ' : '<<<ASSISTANT>>>: '}${h.content}`).join('\n') + `\n<<<USER>>>: ${text}\n`;
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: 'widget', chat_data: { chat_history } })
        });
        const reply = await res.text();
        addMsg(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
      } catch (e) {
        addMsg('Unable to connect to service', 'bot');
      }
      send.disabled = false;
    };

    send.onclick = sendMsg;
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMsg();
      }
    });
  }, 1000);
})();

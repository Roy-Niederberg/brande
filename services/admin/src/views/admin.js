(function() {
  let kbEditor, spEditor, grEditor

  window.ChatWidgetConfig = {
    apiEndpoint: '/admin/ask',
    greetingOverride: () => ({ messages: grEditor.getDraft().map(e => ({ delay: parseInt(e.key) || 0, text: e.content })) }),
    beforeSend: (body) => {
      body.knowledgeBaseOverride = kbEditor.getDraft()
      const spDraft = spEditor.getDraft().filter(e => e.key.startsWith(body.mod + '/'))
      if (spDraft.length) {
        body.systemPromptOverride = {}
        for (const e of spDraft) body.systemPromptOverride[e.key.split('/')[1]] = e.content
      }
      return body
    }
  }

  const escapeHtml = (t) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML }
  const autoResize = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }
  const deepClone = (o) => JSON.parse(JSON.stringify(o))

  const icons = {
    publish: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="7 11 12 16 17 11"/><line x1="12" y1="16" x2="12" y2="3"/></svg>',
    pencil: '<svg class="pencil-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>',
    disk: '<svg class="disk-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    discard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>'
  }

  const style = document.createElement('style')
  style.textContent = `
    .prompt {
      position: absolute; top: 1%; left: 1%; padding: 12px; width: 98%; height: 98%;
      border-radius: 10px; background-color: #fff8; overflow-y: auto; overflow-x: hidden;
      display: none;
    }
    .prompt.visible { display: block; }
    #admin-buttons {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      display: flex; flex-direction: column; gap: 16px; align-items: center;
    }
    .admin-open-btn {
      padding: 16px 32px; width: 240px; color: white; border: 1px solid rgba(0,0,0,0.15);
      border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer;
      transition: all 0.2s ease; box-shadow: 0 4px 14px rgba(0,0,0,0.25); position: relative;
    }
    .admin-open-btn:hover { transform: scale(1.05); }
    .admin-open-btn.has-draft::after {
      content: ''; position: absolute; top: 6px; right: 6px; width: 10px; height: 10px;
      background: #f44336; border-radius: 50%; border: 2px solid white;
    }
    #open-kb-btn { background: #7b8eb5; box-shadow: 0 4px 12px rgba(123,142,181,0.3); }
    #open-kb-btn:hover { background: #6a7da4; }
    #open-sp-btn { background: #c4956d; box-shadow: 0 4px 12px rgba(196,149,109,0.3); }
    #open-sp-btn:hover { background: #b3845c; }
    #open-gr-btn { background: #a87c9e; box-shadow: 0 4px 12px rgba(168,124,158,0.3); }
    #open-gr-btn:hover { background: #976b8d; }
    #open-log-btn { background: #7ba8a0; box-shadow: 0 4px 12px rgba(123,168,160,0.3); }
    #open-log-btn:hover { background: #6a978f; }
    #open-fb-btn { background: #5b7bbf; box-shadow: 0 4px 12px rgba(91,123,191,0.3); }
    #open-fb-btn:hover { background: #4a6aae; }
    .chat-section { position: relative; }
    .fb-panel {
      position: absolute; inset: 0; z-index: 100; background: #f0f2f5;
      display: none;
    }
    .fb-panel.visible { display: block; }
    .fb-panel .top-buttons { position: absolute; top: 8px; right: 8px; z-index: 10; }
    .fb-iframe { width:100%; height:100%; border:none; }
    .log-content {
      display: flex; flex-direction: column; gap: 12px;
      padding-top: 48px; padding-bottom: 20px;
    }
    .log-model {
      padding: 10px 14px; background: #f0f4f8; border-radius: 8px;
      font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; color: #334;
    }
    .log-model b { color: #555; }
    .log-msg {
      border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden;
    }
    .log-msg-header {
      padding: 8px 14px; font-weight: 600; font-size: 13px;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    .log-msg[data-role="system"] .log-msg-header { background: #e8f0fe; color: #1a56db; }
    .log-msg[data-role="user"] .log-msg-header { background: #fef3e2; color: #b45309; }
    .log-msg[data-role="assistant"] .log-msg-header { background: #e6f9ed; color: #166534; }
    .log-msg-content {
      padding: 12px 14px; background: #fff; white-space: pre-wrap; word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5; max-height: 400px; overflow-y: auto;
    }
    .top-buttons { position: absolute; top: 12px; right: 12px; display: flex; direction: ltr; gap: 8px; z-index: 10; }
    .publish-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
      color: white; background: #ff9800; position: relative;
    }
    .publish-btn:hover { transform: scale(1.1); }
    .publish-btn:disabled { background: #ccc; cursor: not-allowed; opacity: 0.6; }
    .discard-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
      color: white; background: #dc3545;
    }
    .discard-btn:hover { background: #c82333; transform: scale(1.1); }
    .discard-btn:disabled { background: #ccc; cursor: not-allowed; opacity: 0.6; }
    .publish-btn.has-changes::after {
      content: ''; position: absolute; top: -2px; right: -2px; width: 10px; height: 10px;
      background: #f44336; border-radius: 50%; border: 2px solid white;
    }
    .refresh-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
      color: white; background: #17a2b8;
    }
    .refresh-btn:hover { background: #138496; transform: scale(1.1); }
    .copy-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.2s ease;
      color: white; background: #28a745;
    }
    .copy-btn:hover { background: #218838; transform: scale(1.1); }
    .close-panel-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
      color: white; background: #6c757d; font-size: 16px;
    }
    .close-panel-btn:hover { background: #5a6268; transform: scale(1.1); }
    .entries-list {
      display: flex; flex-direction: column; gap: 12px;
      padding-top: 40px; padding-bottom: 60px;
    }
    .kb-entry {
      background: #f8f9fa; border: 1px solid #e1e4e8;
      border-radius: 8px; padding: 12px; position: relative;
    }
    .kb-entry.editing {
      background: #fff; border-color: #667eea;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
    }
    .kb-key-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .kb-key {
      flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; font-weight: 600; background: #fff;
    }
    .kb-key:read-only { background: #f0f0f0; border-color: transparent; cursor: default; }
    .kb-key:not(:read-only):focus { outline: none; border-color: #667eea; }
    .kb-content {
      width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.4; resize: none; overflow: hidden; background: #fff;
    }
    .kb-content:read-only { background: #f0f0f0; border-color: transparent; cursor: default; }
    .kb-content:not(:read-only) { resize: vertical; overflow: auto; }
    .kb-content:not(:read-only):focus { outline: none; border-color: #667eea; }
    .entry-btn {
      width: 28px; height: 28px; border-radius: 4px; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s ease; background: #e9ecef; color: #495057;
    }
    .entry-btn:hover { background: #dee2e6; }
    .entry-edit-btn { background: #667eea; color: white; }
    .entry-edit-btn:hover { background: #5a6fd6; }
    .entry-edit-btn.editing { background: #28a745; }
    .entry-edit-btn.editing:hover { background: #218838; }
    .entry-delete-btn { background: #dc3545; color: white; }
    .entry-delete-btn:hover { background: #c82333; }
    .add-entry-btn {
      padding: 12px 24px; background: #28a745; color: white; border: none;
      border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
      transition: all 0.2s ease; align-self: center;
    }
    .add-entry-btn:hover { background: #218838; transform: translateY(-1px); }
    .empty-state { text-align: center; padding: 40px; color: #6c757d; }
    #logout-btn {
      padding: 8px 16px; width: 140px; background: transparent; color: #999;
      border: 1px solid #ccc; border-radius: 8px; font-size: 13px;
      cursor: pointer; transition: all 0.2s ease; margin-top: 8px;
    }
    #logout-btn:hover { color: #dc3545; border-color: #dc3545; }
    @media (max-aspect-ratio: 1/1) { .prompt { width: 100%; height: 100%; border-radius: 0; } }
  `
  document.head.appendChild(style)

  const siteSection = document.querySelector('.site-section')

  function createPanel() {
    const panel = document.createElement('div')
    panel.className = 'prompt'
    panel.innerHTML = `
      <div class="top-buttons">
        <button class="publish-btn" title="Publish Changes">${icons.publish}</button>
        <button class="discard-btn" title="Discard Changes" disabled>${icons.discard}</button>
        <button class="close-panel-btn" title="Close">&times;</button>
      </div>
      <div class="entries-list">Loading...</div>`
    siteSection.appendChild(panel)
    return panel
  }

  function createEditor(panel, cfg) {
    let published = [], draft = []
    const entriesEl = panel.querySelector('.entries-list')
    const publishBtn = panel.querySelector('.publish-btn')
    const discardBtn = panel.querySelector('.discard-btn')

    function render() {
      if (!draft.length) {
        entriesEl.innerHTML = '<div class="empty-state">No entries yet</div>' +
          (cfg.canModify ? '<button class="add-entry-btn">+ Add Entry</button>' : '')
        if (cfg.canModify) entriesEl.querySelector('.add-entry-btn').addEventListener('click', add)
        return
      }
      const addBtn = cfg.canModify ? '<button class="add-entry-btn">+ Add Entry</button>' : ''
      entriesEl.innerHTML = draft.map((e, i) => `
        <div class="kb-entry" data-index="${i}">
          <div class="kb-key-row">
            <input class="kb-key" value="${escapeHtml(e.key || '')}" readonly>
            <button class="entry-btn entry-edit-btn" data-index="${i}" title="Edit">${icons.pencil}${icons.disk}</button>
            ${cfg.canModify ? `<button class="entry-btn entry-delete-btn" data-index="${i}" title="Delete">${icons.trash}</button>` : ''}
          </div>
          <textarea class="kb-content" readonly>${escapeHtml(e.content || '')}</textarea>
        </div>`).join('') + addBtn
      entriesEl.querySelectorAll('.entry-edit-btn').forEach(b =>
        b.addEventListener('click', () => toggleEdit(parseInt(b.dataset.index))))
      if (cfg.canModify) entriesEl.querySelectorAll('.entry-delete-btn').forEach(b =>
        b.addEventListener('click', () => remove(parseInt(b.dataset.index))))
      entriesEl.querySelectorAll('.kb-content').forEach(ta =>
        ta.addEventListener('input', () => autoResize(ta)))
      if (cfg.canModify) entriesEl.querySelector('.add-entry-btn').addEventListener('click', add)
      setTimeout(() => entriesEl.querySelectorAll('.kb-content').forEach(autoResize), 0)
    }

    function toggleEdit(i) {
      const el = entriesEl.querySelector(`.kb-entry[data-index="${i}"]`)
      const key = el.querySelector('.kb-key'), content = el.querySelector('.kb-content')
      const btn = el.querySelector('.entry-edit-btn'), editing = el.classList.contains('editing')
      if (editing) {
        draft[i] = { key: key.value, content: content.value }
        saveDraft()
        el.classList.remove('editing'); btn.classList.remove('editing')
        key.readOnly = content.readOnly = true
        btn.querySelector('.pencil-icon').style.display = 'block'
        btn.querySelector('.disk-icon').style.display = 'none'
      } else {
        el.classList.add('editing'); btn.classList.add('editing')
        if (cfg.canModify) key.readOnly = false
        content.readOnly = false
        btn.querySelector('.pencil-icon').style.display = 'none'
        btn.querySelector('.disk-icon').style.display = 'block'
        content.focus()
      }
    }

    function add() {
      draft.push({ key: '', content: '' })
      saveDraft(); render(); toggleEdit(draft.length - 1)
    }

    function remove(i) {
      const preview = draft[i].key ? `"${draft[i].key}"` : '(empty key)'
      if (!confirm(`Delete entry ${preview}?`)) return
      draft.splice(i, 1); saveDraft(); render()
    }

    function saveDraft() {
      localStorage.setItem(cfg.draftKey,
        JSON.stringify({ content: draft, timestamp: new Date().toISOString() }))
      updatePublish()
    }

    function updatePublish() {
      const changed = JSON.stringify(draft) !== JSON.stringify(published)
      publishBtn.classList.toggle('has-changes', changed)
      publishBtn.disabled = !changed
      publishBtn.title = changed ? 'Publish Changes' : 'No changes to publish'
      discardBtn.disabled = !changed
      if (cfg.openBtn) cfg.openBtn.classList.toggle('has-draft', changed)
    }

    discardBtn.addEventListener('click', () => {
      if (!confirm('Discard all changes?')) return
      draft = deepClone(published)
      localStorage.removeItem(cfg.draftKey)
      render(); updatePublish()
    })

    publishBtn.addEventListener('click', async () => {
      if (!confirm('Publish changes? This will affect all users.')) return
      try {
        const res = await fetch(cfg.publishUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg.toBody(draft))
        })
        if (res.ok) {
          published = deepClone(draft)
          localStorage.removeItem(cfg.draftKey); updatePublish(); alert('Published!')
        } else alert('Failed to publish')
      } catch { alert('Error publishing') }
    })

    return {
      load(data) {
        published = data
        const saved = localStorage.getItem(cfg.draftKey)
        if (saved) {
          try { draft = JSON.parse(saved).content }
          catch { draft = deepClone(published) }
          if (!Array.isArray(draft)) draft = deepClone(published)
        } else draft = deepClone(published)
        render(); updatePublish()
      },
      getDraft() { return draft },
      showError(msg) {
        entriesEl.innerHTML = `<div class="empty-state" style="color:#e74c3c">${msg}</div>`
      }
    }
  }

  // Create panels and admin buttons
  const kbPanel = createPanel()
  const spPanel = createPanel()
  const grPanel = createPanel()

  const logPanel = document.createElement('div')
  logPanel.className = 'prompt'
  const refreshSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  const copySvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  logPanel.innerHTML = `
    <div class="top-buttons">
      <button class="copy-btn" title="Copy All">${copySvg}</button>
      <button class="refresh-btn" title="Refresh">${refreshSvg}</button>
      <button class="close-panel-btn" title="Close">&times;</button>
    </div>
    <div class="log-content"></div>`
  siteSection.appendChild(logPanel)

  const logContent = logPanel.querySelector('.log-content')

  async function loadLastPrompt() {
    try {
      const data = await fetch('/admin/api/last_prompt').then(r => r.json())
      let html = `<div class="log-model"><b>model:</b> ${escapeHtml(data.model || '?')}</div>`
      if (Array.isArray(data.messages)) {
        for (const m of data.messages) {
          const role = m.role || 'unknown'
          html += `<div class="log-msg" data-role="${escapeHtml(role)}">
            <div class="log-msg-header">${escapeHtml(role)}</div>
            <div class="log-msg-content">${escapeHtml(m.content || '')}</div></div>`
        }
      }
      if (data.response) {
        html += `<div class="log-msg" data-role="assistant">
          <div class="log-msg-header">response (raw)</div>
          <div class="log-msg-content">${escapeHtml(data.response)}</div></div>`
      }
      logContent.innerHTML = html
    } catch { logContent.innerHTML = '<div style="color:#e74c3c;padding:40px;text-align:center">Error loading last prompt</div>' }
  }

  logPanel.querySelector('.copy-btn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(logContent.innerText)
    const btn = logPanel.querySelector('.copy-btn')
    btn.style.background = '#17a2b8'
    setTimeout(() => btn.style.background = '', 600)
  })

  logPanel.querySelector('.refresh-btn').addEventListener('click', loadLastPrompt)

  const fbPanel = document.createElement('div')
  fbPanel.className = 'fb-panel'
  fbPanel.innerHTML = `
    <div class="top-buttons">
      <button class="close-panel-btn" title="Close">&times;</button>
    </div>
    <iframe class="fb-iframe" src="/mock-facebook/"></iframe>`
  document.querySelector('.chat-section').appendChild(fbPanel)

  const adminBtns = document.createElement('div')
  adminBtns.id = 'admin-buttons'
  adminBtns.innerHTML = `
    <button id="open-kb-btn" class="admin-open-btn">Edit Knowledge Base</button>
    <button id="open-sp-btn" class="admin-open-btn">Edit System Prompts</button>
    <button id="open-gr-btn" class="admin-open-btn">Edit Greeting</button>
    <button id="open-log-btn" class="admin-open-btn">See Prompt</button>
    <button id="open-fb-btn" class="admin-open-btn">Test Facebook Comments</button>
    <button id="logout-btn">Logout</button>`
  siteSection.appendChild(adminBtns)

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Log out?')) window.location.href =
      'https://qabu.net/auth/logout?return_to=' + encodeURIComponent(location.origin)
  })

  const openPanel = (panel) => {
    panel.classList.add('visible'); adminBtns.style.display = 'none'
    setTimeout(() => panel.querySelectorAll('.kb-content').forEach(autoResize), 0)
  }
  const closePanel = (panel) => { panel.classList.remove('visible'); adminBtns.style.display = '' }

  document.getElementById('open-kb-btn').addEventListener('click', () => openPanel(kbPanel))
  document.getElementById('open-sp-btn').addEventListener('click', () => openPanel(spPanel))
  document.getElementById('open-gr-btn').addEventListener('click', () => openPanel(grPanel))
  document.getElementById('open-fb-btn').addEventListener('click', () => fbPanel.classList.toggle('visible'))
  document.getElementById('open-log-btn').addEventListener('click', () => {
    openPanel(logPanel); loadLastPrompt()
  })
  kbPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(kbPanel))
  spPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(spPanel))
  grPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(grPanel))
  logPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(logPanel))
  fbPanel.querySelector('.close-panel-btn').addEventListener('click', () => fbPanel.classList.remove('visible'))

  kbEditor = createEditor(kbPanel, {
    draftKey: 'kb_draft', canModify: true, openBtn: document.getElementById('open-kb-btn'),
    publishUrl: '/admin/api/knowledge_base',
    toBody: (draft) => ({ knowledgeBase: draft })
  })

  spEditor = createEditor(spPanel, {
    draftKey: 'sp_draft', canModify: false, openBtn: document.getElementById('open-sp-btn'),
    publishUrl: '/admin/api/system_prompts',
    toBody: (draft) => {
      const sp = {}
      for (const e of draft) {
        const [mod, field] = e.key.split('/')
        if (!sp[mod]) sp[mod] = {}
        sp[mod][field] = e.content
      }
      return { systemPrompts: sp }
    }
  })

  grEditor = createEditor(grPanel, {
    draftKey: 'gr_draft', canModify: true, openBtn: document.getElementById('open-gr-btn'),
    publishUrl: '/admin/api/greeting',
    toBody: (draft) => ({ greeting: { widget: { messages: draft.map(e => ({ delay: parseInt(e.key) || 0, text: e.content })) } } })
  })

  // Load data
  ;(async () => {
    try {
      const data = await fetch('/admin/api/initial-content').then(r => r.json())

      if (data.knowledgeBase) {
        let kb = data.knowledgeBase
        if (typeof kb === 'string') try { kb = JSON.parse(kb) } catch { kb = [] }
        if (!Array.isArray(kb)) kb = []
        kbEditor.load(kb)
      } else kbEditor.showError('No knowledge base available')

      if (data.instructions) {
        let sp = data.instructions
        if (typeof sp === 'string') try { sp = JSON.parse(sp) } catch { sp = {} }
        if (typeof sp !== 'object' || Array.isArray(sp)) sp = {}
        const entries = []
        for (const [mod, fields] of Object.entries(sp)) {
          for (const [field, content] of Object.entries(fields))
            entries.push({ key: `${mod}/${field}`, content })
        }
        spEditor.load(entries)
      } else spEditor.showError('No system prompts available')

      if (data.greeting) {
        let gr = data.greeting
        if (typeof gr === 'string') try { gr = JSON.parse(gr) } catch { gr = {} }
        const msgs = gr.widget?.messages || []
        grEditor.load(msgs.map(m => ({ key: String(m.delay), content: m.text })))
      } else grEditor.showError('No greeting available')
    } catch {
      kbEditor.showError('Error loading knowledge base')
      spEditor.showError('Error loading system prompts')
      grEditor.showError('Error loading greeting')
    }
  })()
})()

(function() {
  let kbEditor, spEditor

  window.ChatWidgetConfig = {
    apiEndpoint: '/admin/ask',
    beforeSend: (body) => {
      body.knowledgeBaseOverride = kbEditor.getDraft()
      body.systemPromptOverride = Object.fromEntries(spEditor.getDraft().map(e => [e.key, e.content]))
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
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
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
      transition: all 0.2s ease; box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }
    .admin-open-btn:hover { transform: scale(1.05); }
    #open-kb-btn { background: #7b8eb5; box-shadow: 0 4px 12px rgba(123,142,181,0.3); }
    #open-kb-btn:hover { background: #6a7da4; }
    #open-sp-btn { background: #c4956d; box-shadow: 0 4px 12px rgba(196,149,109,0.3); }
    #open-sp-btn:hover { background: #b3845c; }
    #open-gr-btn { background: #a87c9e; box-shadow: 0 4px 12px rgba(168,124,158,0.3); }
    #open-gr-btn:hover { background: #976b8d; }
    #open-log-btn { background: #7ba8a0; box-shadow: 0 4px 12px rgba(123,168,160,0.3); }
    #open-log-btn:hover { background: #6a978f; }
    .log-tabs { display: flex; gap: 0; }
    .log-tab {
      padding: 10px 24px; border: 1px solid #ddd; border-bottom: none;
      background: #f0f0f0; cursor: pointer; font-size: 14px; font-weight: 500;
      border-radius: 8px 8px 0 0; transition: all 0.2s ease; color: #666;
    }
    .log-tab:hover { background: #e8e8e8; }
    .log-tab.active { background: #fff; border-color: #667eea; color: #667eea; }
    .log-panel { overflow: hidden; display: none; flex-direction: column; padding: 16px; }
    .log-panel.visible { display: flex; }
    .log-header {
      display: flex; direction: ltr; justify-content: space-between; align-items: flex-end;
    }
    .log-header .top-buttons { position: static; align-items: center; }
    .log-content {
      border: 1px solid #ddd; border-radius: 0 8px 8px 8px; padding: 16px;
      background: #fff; white-space: pre-wrap; word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5;
      overflow-y: auto; flex: 1; margin: 0;
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

  const bgSection = document.querySelector('.bg-section')

  function createPanel() {
    const panel = document.createElement('div')
    panel.className = 'prompt'
    panel.innerHTML = `
      <div class="top-buttons">
        <button class="publish-btn" title="Publish Changes">${icons.publish}</button>
        <button class="close-panel-btn" title="Close">&times;</button>
      </div>
      <div class="entries-list">Loading...</div>`
    bgSection.appendChild(panel)
    return panel
  }

  function createEditor(panel, cfg) {
    let published = [], draft = []
    const entriesEl = panel.querySelector('.entries-list')
    const publishBtn = panel.querySelector('.publish-btn')

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
    }

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
  logPanel.className = 'prompt log-panel'
  const refreshSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  logPanel.innerHTML = `
    <div class="log-header">
      <div class="log-tabs">
        <button class="log-tab active" data-log="admin_ask_widget">Admin</button>
        <button class="log-tab" data-log="site_ask_widget">Site</button>
      </div>
      <div class="top-buttons">
        <button class="copy-btn" title="Copy All"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="refresh-btn" title="Refresh">${refreshSvg}</button>
        <button class="close-panel-btn" title="Close">&times;</button>
      </div>
    </div>
    <pre class="log-content"></pre>`
  bgSection.appendChild(logPanel)

  const logContent = logPanel.querySelector('.log-content')
  const logTabs = logPanel.querySelectorAll('.log-tab')
  const logCache = {}

  async function loadLog(name, force) {
    if (!force && logCache[name]) { logContent.textContent = logCache[name]; return }
    logContent.textContent = 'Loading...'
    try {
      const res = await fetch(`/admin/api/prompt-log/${name}`)
      logCache[name] = res.ok ? await res.text() : 'No log found'
    } catch { logCache[name] = 'Error loading log' }
    logContent.textContent = logCache[name]
  }

  logTabs.forEach(tab => tab.addEventListener('click', () => {
    logTabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    loadLog(tab.dataset.log)
  }))

  logPanel.querySelector('.copy-btn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(logContent.textContent)
    const btn = logPanel.querySelector('.copy-btn')
    btn.style.background = '#17a2b8'
    setTimeout(() => btn.style.background = '', 600)
  })

  logPanel.querySelector('.refresh-btn').addEventListener('click', () => {
    const active = logPanel.querySelector('.log-tab.active')
    loadLog(active.dataset.log, true)
  })

  const adminBtns = document.createElement('div')
  adminBtns.id = 'admin-buttons'
  adminBtns.innerHTML = `
    <button id="open-kb-btn" class="admin-open-btn">Edit Knowledge Base</button>
    <button id="open-sp-btn" class="admin-open-btn">Edit System Prompts</button>
    <button id="open-gr-btn" class="admin-open-btn">Edit Greeting</button>
    <button id="open-log-btn" class="admin-open-btn">See Last Prompt</button>
    <button id="logout-btn">Logout</button>`
  bgSection.appendChild(adminBtns)

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Log out?')) window.location.href = '/admin/logout'
  })

  const openPanel = (panel) => {
    panel.classList.add('visible'); adminBtns.style.display = 'none'
    setTimeout(() => panel.querySelectorAll('.kb-content').forEach(autoResize), 0)
  }
  const closePanel = (panel) => { panel.classList.remove('visible'); adminBtns.style.display = '' }

  document.getElementById('open-kb-btn').addEventListener('click', () => openPanel(kbPanel))
  document.getElementById('open-sp-btn').addEventListener('click', () => openPanel(spPanel))
  document.getElementById('open-gr-btn').addEventListener('click', () => openPanel(grPanel))
  document.getElementById('open-log-btn').addEventListener('click', () => {
    logCache.admin_ask_widget = logCache.site_ask_widget = null
    openPanel(logPanel); loadLog('admin_ask_widget')
  })
  kbPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(kbPanel))
  spPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(spPanel))
  grPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(grPanel))
  logPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(logPanel))

  kbEditor = createEditor(kbPanel, {
    draftKey: 'kb_draft', canModify: true,
    publishUrl: '/admin/api/knowledge-base',
    toBody: (draft) => ({ knowledgeBase: draft })
  })

  spEditor = createEditor(spPanel, {
    draftKey: 'sp_draft', canModify: false,
    publishUrl: '/admin/api/instructions',
    toBody: (draft) => ({ instructions: Object.fromEntries(draft.map(e => [e.key, e.content])) })
  })

  const grEditor = createEditor(grPanel, {
    draftKey: 'gr_draft', canModify: true,
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
        spEditor.load(Object.entries(sp).map(([key, content]) => ({ key, content })))
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

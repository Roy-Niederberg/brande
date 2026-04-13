(function() {
  let kbEditor, spEditor, grEditor

  window.ChatWidgetConfig = {
    apiEndpoint: '/admin/ask',
    greetingOverride: () => ({ messages: grEditor.getDraft().map(e => ({ delay: parseInt(e.key) || 0, text: e.content })) }),
    beforeSend: (body) => {
      body.knowledgeBaseOverride = kbEditor.getDraft()
      body.systemPromptOverride = {}
      for (const e of spEditor.getDraft())
        if (e.key.startsWith(body.mod + '/')) body.systemPromptOverride[e.key.split('/')[1]] = e.content
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
    #panel-area {
      display: none; flex-shrink: 0; min-width: 420px; width: 42vw; max-width: 700px; overflow: hidden;
    }
    #panel-area.has-panel { display: block; }
    #panel-area .prompt {
      position: relative; top: auto; left: auto;
      width: 100%; height: 100%; border-radius: 0;
    }
    @media (min-aspect-ratio: 13/10) {
      #panel-area { height: calc(100dvh - 16px); margin-top: 8px; margin-bottom: 8px; }
    }
    @media (max-aspect-ratio: 1/1) {
      #panel-area {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 50;
      }
    }
    body.admin-mode { display: flex; flex-direction: row; }
    body.admin-mode > .container { flex: 1; min-width: 0; }
    #admin-buttons {
      display: flex; flex-direction: column; gap: 0; align-items: stretch;
      padding: 0; background: #c0c0c0; flex-shrink: 0;
      border-right: 2px solid #808080;
    }
    .admin-open-btn {
      padding: 3px 6px; color: #000; background: #c0c0c0; border: none;
      border-bottom: 1px solid #808080; font-size: 11px; font-weight: normal;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      cursor: pointer; position: relative; text-align: left;
      line-height: 1.4; white-space: nowrap;
    }
    .admin-open-btn:hover { background: #000080; color: #fff; }
    .admin-open-btn.active { background: #000080; color: #fff; }
    .admin-open-btn.has-draft::after {
      content: '*'; position: static; display: inline;
      color: #f00; font-weight: bold; margin-left: 2px;
    }
    @media (max-aspect-ratio: 1/1) {
      body.admin-mode { flex-direction: column; }
      #admin-buttons {
        flex-direction: row; border-right: none;
        border-bottom: 2px solid #808080;
      }
      .admin-open-btn { border-bottom: none; border-right: 1px solid #808080; }
    }
    .svc-list { display: flex; flex-direction: column; gap: 16px; padding-top: 48px; padding-bottom: 20px; }
    .svc-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8f9fa; border: 1px solid #e1e4e8; border-radius: 8px; }
    .svc-label { font-size: 15px; font-weight: 500; }
    .svc-toggle { position: relative; width: 44px; height: 24px; }
    .svc-toggle input { opacity: 0; width: 0; height: 0; }
    .svc-slider { position: absolute; inset: 0; background: #ccc; border-radius: 24px; cursor: pointer; transition: 0.3s; }
    .svc-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
    .svc-toggle input:checked + .svc-slider { background: #28a745; }
    .svc-toggle input:checked + .svc-slider::before { transform: translateX(20px); }
    .svc-save-btn { padding: 10px 24px; background: #28a745; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; align-self: center; }
    .svc-save-btn:hover { background: #218838; }
    .svc-save-btn:disabled { background: #ccc; cursor: not-allowed; }
    .svc-note { text-align: center; color: #6c757d; font-size: 13px; padding: 8px; }
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
      padding: 3px 6px; background: #c0c0c0; color: #808080; border: none;
      border-top: 1px solid #808080; font-size: 11px; cursor: pointer;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin-top: auto; text-align: left;
    }
    #logout-btn:hover { color: #fff; background: #800000; }
    @media (max-aspect-ratio: 1/1) {
      #logout-btn { margin-top: 0; border-top: none; border-left: 1px solid #808080; }
      .prompt { width: 100%; height: 100%; border-radius: 0; }
    }
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

  const svcPanel = document.createElement('div')
  svcPanel.className = 'prompt'
  svcPanel.innerHTML = `
    <div class="top-buttons">
      <button class="close-panel-btn" title="Close">&times;</button>
    </div>
    <div class="svc-list">Loading...</div>`
  siteSection.appendChild(svcPanel)

  const PROFILES = { site: 'Site', facebook: 'Facebook (Comments, DM & Mock)' }

  async function loadServices() {
    const list = svcPanel.querySelector('.svc-list')
    try {
      const { profiles } = await fetch('/admin/api/services').then(r => r.json())
      list.innerHTML = Object.entries(PROFILES).map(([k, label]) => `
        <div class="svc-row">
          <span class="svc-label">${label}</span>
          <label class="svc-toggle"><input type="checkbox" data-profile="${k}" ${profiles.includes(k) ? 'checked' : ''}><span class="svc-slider"></span></label>
        </div>`).join('') +
        '<button class="svc-save-btn">Save & Apply</button>'
      list.querySelector('.svc-save-btn').addEventListener('click', saveServices)
    } catch { list.innerHTML = '<div class="empty-state" style="color:#e74c3c">Error loading services</div>' }
  }

  async function saveServices() {
    const btn = svcPanel.querySelector('.svc-save-btn')
    const profiles = []
    svcPanel.querySelectorAll('[data-profile]').forEach(cb => { if (cb.checked) profiles.push(cb.dataset.profile) })
    btn.disabled = true
    try {
      await fetch('/admin/api/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles })
      })
      alert('Services updated! Changes will apply shortly.')
    } catch { alert('Error saving services') }
    btn.disabled = false
  }

  const adminBtns = document.createElement('div')
  adminBtns.id = 'admin-buttons'
  adminBtns.innerHTML = `
    <button id="open-kb-btn" class="admin-open-btn">KB</button>
    <button id="open-sp-btn" class="admin-open-btn">SP</button>
    <button id="open-gr-btn" class="admin-open-btn">Greet</button>
    <button id="open-log-btn" class="admin-open-btn">Logs</button>
    <button id="open-fb-btn" class="admin-open-btn">FB</button>
    <button id="open-svc-btn" class="admin-open-btn">Services</button>
    <button id="logout-btn">Logout</button>`
  document.body.classList.add('admin-mode')
  const container = document.querySelector('.container')
  document.body.insertBefore(adminBtns, container)
  const panelArea = document.createElement('div')
  panelArea.id = 'panel-area'
  document.body.insertBefore(panelArea, container)
  panelArea.append(kbPanel, spPanel, grPanel, logPanel, svcPanel)

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Log out?')) window.location.href =
      'https://qabu.net/auth/logout?return_to=' + encodeURIComponent(location.origin)
  })

  const allPanels = [kbPanel, spPanel, grPanel, logPanel, svcPanel]
  const clearActive = () => adminBtns.querySelectorAll('.admin-open-btn').forEach(b => b.classList.remove('active'))
  const openPanel = (panel, btn) => {
    if (panel.classList.contains('visible')) {
      closePanel(panel)
      return false
    }
    allPanels.forEach(p => p.classList.remove('visible'))
    fbPanel.classList.remove('visible')
    clearActive()
    panel.classList.add('visible')
    panelArea.classList.add('has-panel')
    if (btn) btn.classList.add('active')
    setTimeout(() => panel.querySelectorAll('.kb-content').forEach(autoResize), 0)
    return true
  }
  const closePanel = (panel) => {
    panel.classList.remove('visible')
    panelArea.classList.remove('has-panel')
    clearActive()
  }

  const kbBtn = document.getElementById('open-kb-btn')
  const spBtn = document.getElementById('open-sp-btn')
  const grBtn = document.getElementById('open-gr-btn')
  const fbBtn = document.getElementById('open-fb-btn')
  const svcBtn = document.getElementById('open-svc-btn')
  const logBtn = document.getElementById('open-log-btn')
  kbBtn.addEventListener('click', () => openPanel(kbPanel, kbBtn))
  spBtn.addEventListener('click', () => openPanel(spPanel, spBtn))
  grBtn.addEventListener('click', () => openPanel(grPanel, grBtn))
  fbBtn.addEventListener('click', () => {
    allPanels.forEach(p => p.classList.remove('visible'))
    panelArea.classList.remove('has-panel')
    clearActive()
    fbPanel.classList.toggle('visible')
    if (fbPanel.classList.contains('visible')) fbBtn.classList.add('active')
  })
  svcBtn.addEventListener('click', () => { if (openPanel(svcPanel, svcBtn)) loadServices() })
  logBtn.addEventListener('click', () => { if (openPanel(logPanel, logBtn)) loadLastPrompt() })
  kbPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(kbPanel))
  spPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(spPanel))
  grPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(grPanel))
  logPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(logPanel))
  fbPanel.querySelector('.close-panel-btn').addEventListener('click', () => { fbPanel.classList.remove('visible'); clearActive() })
  svcPanel.querySelector('.close-panel-btn').addEventListener('click', () => closePanel(svcPanel))

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

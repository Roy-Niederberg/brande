(function() {
  let publishedKB = [], draftKB = []
  const DRAFT_KEY = 'kb_draft'

  window.ChatWidgetConfig = {
    apiEndpoint: '/admin/ask',
    beforeSend: (body) => { body.knowledgeBaseOverride = draftKB; return body }
  }

  const style = document.createElement('style')
  style.textContent = `
    .prompt {
      position: absolute; top: 1%; left: 1%; padding: 12px; width: 98%; height: 98%;
      border-radius: 10px; background-color: #fff8; overflow-y: auto; overflow-x: hidden;
      display: none;
    }
    .prompt.visible { display: block; }
    #open-kb-btn {
      padding: 16px 32px; background: #667eea; color: white; border: none;
      border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer;
      transition: all 0.2s ease; position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%); box-shadow: 0 4px 12px rgba(102,126,234,0.4);
    }
    #open-kb-btn:hover { background: #5a6fd6; transform: translate(-50%, -50%) scale(1.05); }
    #close-kb-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
      color: white; background: #6c757d; font-size: 16px;
    }
    #close-kb-btn:hover { background: #5a6268; transform: scale(1.1); }
    .top-buttons { position: absolute; top: 12px; right: 12px; display: flex; direction: ltr; gap: 8px; z-index: 10; }
    #publish-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
      color: white; background: #ff9800; position: relative;
    }
    #publish-btn:hover { transform: scale(1.1); }
    #publish-btn:disabled { background: #ccc; cursor: not-allowed; opacity: 0.6; }
    #publish-btn.has-changes::after {
      content: ''; position: absolute; top: -2px; right: -2px; width: 10px; height: 10px;
      background: #f44336; border-radius: 50%; border: 2px solid white;
    }
    #kb-entries {
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
    #add-entry-btn {
      padding: 12px 24px; background: #28a745; color: white; border: none;
      border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
      transition: all 0.2s ease; align-self: center;
    }
    #add-entry-btn:hover { background: #218838; transform: translateY(-1px); }
    .empty-state { text-align: center; padding: 40px; color: #6c757d; }
    @media (max-aspect-ratio: 1/1) { .prompt { width: 100%; height: 100%; border-radius: 0; } }
  `
  document.head.appendChild(style)

  const prompt = document.createElement('div')
  prompt.className = 'prompt'
  prompt.id = 'prompt-edit-container'
  prompt.innerHTML = `
    <div class="top-buttons">
      <button id="publish-btn" title="Publish Changes">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
          <polyline points="7 11 12 16 17 11"/><line x1="12" y1="16" x2="12" y2="3"/>
        </svg>
      </button>
      <button id="close-kb-btn" title="Close">&times;</button>
    </div>
    <div id="kb-entries">Loading...</div>`
  const bgSection = document.querySelector('.bg-section')
  const openBtn = document.createElement('button')
  openBtn.id = 'open-kb-btn'
  openBtn.textContent = 'Edit Knowledge Base'
  bgSection.appendChild(openBtn)
  bgSection.appendChild(prompt)

  openBtn.addEventListener('click', () => {
    prompt.classList.add('visible'); openBtn.style.display = 'none'
  })
  document.getElementById('close-kb-btn').addEventListener('click', () => {
    prompt.classList.remove('visible'); openBtn.style.display = ''
  })

  const escapeHtml = (t) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML }
  const autoResize = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }
  const parseKB = (d) => {
    if (typeof d === 'string') try { return JSON.parse(d) } catch { return [] }
    return Array.isArray(d) ? d : []
  }

  function renderEntries() {
    const container = document.getElementById('kb-entries')
    if (!draftKB.length) {
      container.innerHTML = '<div class="empty-state">No entries yet</div><button id="add-entry-btn">+ Add Entry</button>'
      document.getElementById('add-entry-btn').addEventListener('click', addEntry)
      return
    }
    const pencil = '<svg class="pencil-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>'
    const disk = '<svg class="disk-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
    const trash = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    container.innerHTML = draftKB.map((e, i) => `
      <div class="kb-entry" data-index="${i}">
        <div class="kb-key-row">
          <input class="kb-key" value="${escapeHtml(e.key || '')}" readonly>
          <button class="entry-btn entry-edit-btn" data-index="${i}" title="Edit">${pencil}${disk}</button>
          <button class="entry-btn entry-delete-btn" data-index="${i}" title="Delete">${trash}</button>
        </div>
        <textarea class="kb-content" readonly>${escapeHtml(e.content || '')}</textarea>
      </div>`).join('') + '<button id="add-entry-btn">+ Add Entry</button>'
    container.querySelectorAll('.entry-edit-btn').forEach(b =>
      b.addEventListener('click', () => toggleEdit(parseInt(b.dataset.index))))
    container.querySelectorAll('.entry-delete-btn').forEach(b =>
      b.addEventListener('click', () => deleteEntry(parseInt(b.dataset.index))))
    container.querySelectorAll('.kb-content').forEach(ta =>
      ta.addEventListener('input', () => autoResize(ta)))
    document.getElementById('add-entry-btn').addEventListener('click', addEntry)
    setTimeout(() => document.querySelectorAll('.kb-content').forEach(autoResize), 0)
  }

  function toggleEdit(i) {
    const el = document.querySelector(`.kb-entry[data-index="${i}"]`)
    const key = el.querySelector('.kb-key'), content = el.querySelector('.kb-content')
    const btn = el.querySelector('.entry-edit-btn'), editing = el.classList.contains('editing')
    if (editing) {
      draftKB[i] = { key: key.value, content: content.value }
      saveDraft()
      el.classList.remove('editing'); btn.classList.remove('editing')
      key.readOnly = content.readOnly = true
      btn.querySelector('.pencil-icon').style.display = 'block'
      btn.querySelector('.disk-icon').style.display = 'none'
    } else {
      el.classList.add('editing'); btn.classList.add('editing')
      key.readOnly = content.readOnly = false
      btn.querySelector('.pencil-icon').style.display = 'none'
      btn.querySelector('.disk-icon').style.display = 'block'
      key.focus()
    }
  }

  function addEntry() {
    draftKB.push({ key: '', content: '' })
    saveDraft(); renderEntries(); toggleEdit(draftKB.length - 1)
  }

  function deleteEntry(i) {
    const preview = draftKB[i].key ? `"${draftKB[i].key}"` : '(empty key)'
    if (!confirm(`Delete entry ${preview}?`)) return
    draftKB.splice(i, 1); saveDraft(); renderEntries()
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ content: draftKB, timestamp: new Date().toISOString() }))
    updatePublishBtn()
  }

  function updatePublishBtn() {
    const btn = document.getElementById('publish-btn')
    const changed = JSON.stringify(draftKB) !== JSON.stringify(publishedKB)
    btn.classList.toggle('has-changes', changed)
    btn.disabled = !changed
    btn.title = changed ? 'Publish Changes' : 'No changes to publish'
  }

  document.getElementById('publish-btn').addEventListener('click', async () => {
    if (!confirm('Publish changes? This will affect all users.')) return
    try {
      const res = await fetch('/admin/api/knowledge-base', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBase: draftKB })
      })
      if (res.ok) {
        publishedKB = JSON.parse(JSON.stringify(draftKB))
        localStorage.removeItem(DRAFT_KEY); updatePublishBtn(); alert('Published!')
      } else alert('Failed to publish')
    } catch { alert('Error publishing') }
  })

  // Load knowledge base
  ;(async () => {
    try {
      const data = await fetch('/admin/api/initial-content').then(r => r.json())
      if (!data.knowledgeBase) {
        document.getElementById('kb-entries').innerHTML = '<div class="empty-state">No knowledge base available</div>'
        return
      }
      publishedKB = parseKB(data.knowledgeBase)
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        try { draftKB = parseKB(JSON.parse(saved).content) }
        catch { draftKB = JSON.parse(JSON.stringify(publishedKB)) }
      } else draftKB = JSON.parse(JSON.stringify(publishedKB))
      renderEntries(); updatePublishBtn()
    } catch {
      document.getElementById('kb-entries').innerHTML =
        '<div class="empty-state" style="color:#e74c3c">Error loading knowledge base</div>'
    }
  })()
})()

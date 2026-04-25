(async function() {
    const isAdmin = location.pathname.startsWith('/admin')
    const prefix = isAdmin ? '/admin' : ''

    // In admin context, load admin.js first (sets ChatWidgetConfig overrides)
    if (isAdmin) {
        const s = document.createElement('script')
        s.src = `${prefix}/admin.js`
        await new Promise(r => { s.onload = r; document.head.appendChild(s) })
    }

    const config = await fetch(`${prefix}/private/client-config.json`).then(r => r.json()).catch(() => ({}))

    document.documentElement.lang = config.lang || 'en'
    document.documentElement.dir = config.direction || 'ltr'
    document.title = (config.title || 'Chat') + (isAdmin ? ' - Admin' : '')

    // Reorder sections based on direction (RTL: chat first, LTR: site first)
    const container = document.querySelector('.container')
    const chatSection = document.querySelector('.chat-section')
    const siteSection = document.querySelector('.site-section')
    if (config.direction === 'ltr') container.insertBefore(siteSection, chatSection)

    // Load custom font
    if (config.font?.url) {
        const preconnect1 = document.createElement('link')
        preconnect1.rel = 'preconnect'
        preconnect1.href = 'https://fonts.googleapis.com'
        document.head.appendChild(preconnect1)

        const preconnect2 = document.createElement('link')
        preconnect2.rel = 'preconnect'
        preconnect2.href = 'https://fonts.gstatic.com'
        preconnect2.crossOrigin = 'anonymous'
        document.head.appendChild(preconnect2)

        const fontLink = document.createElement('link')
        fontLink.rel = 'stylesheet'
        fontLink.href = config.font.url
        document.head.appendChild(fontLink)
    }

    // Set iframe src (external client site or built-in visual page)
    document.getElementById('site-frame').src = config.siteUrl || `${prefix}/page/`

    // Initialize chat widget
    window.ChatWidgetConfig = {
        targetElement: '#chat-section',
        canvasElement: '.site-section',
        clientName: config.overlayTitle || '',
        direction: config.direction || 'ltr',
        profilePic: config.profilePic || '',
        ...(config.widget || {}),
        ...(window.ChatWidgetConfig || {})
    }

    // Load widget
    const widgetScript = document.createElement('script')
    const widgetReady = new Promise(r => { widgetScript.onload = r })
    widgetScript.src = '/widget.js'
    document.body.appendChild(widgetScript)

    // Hide spinner once widget is ready
    await widgetReady
    const loader = document.getElementById('qabu-loader')
    if (loader) { loader.classList.add('hide'); setTimeout(() => loader.remove(), 400) }
})()

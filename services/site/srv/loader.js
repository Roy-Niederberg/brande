(async function() {
    const config = await fetch('/private/client-config.json').then(r => r.json()).catch(() => ({}))

    document.documentElement.lang = config.lang || 'en'
    document.documentElement.dir = config.direction || 'ltr'
    document.title = config.title || 'Chat'

    // Reorder sections based on direction (RTL: chat first, LTR: site first)
    const container = document.querySelector('.container')
    const chatSection = document.querySelector('.chat-section')
    const siteSection = document.querySelector('.site-section')
    if (config.direction === 'ltr') container.insertBefore(siteSection, chatSection)

    // Set iframe src (external client site or built-in page)
    document.getElementById('site-frame').src = config.siteUrl || '/page/'

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

    // Hide spinner once widget is ready (min 600ms to avoid flash)
    await Promise.all([widgetReady, new Promise(r => setTimeout(r, 600))])
    const loader = document.getElementById('qabu-loader')
    if (loader) { loader.classList.add('hide'); setTimeout(() => loader.remove(), 400) }
})()

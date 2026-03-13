/**
 * Admin configuration loader
 * Fetches client-config.json and sets up the admin page
 */
(async function() {
    const config = await fetch('/admin/assets/client-config.json').then(r => r.json()).catch(() => ({}))

    document.documentElement.lang = config.lang || 'en'
    document.documentElement.dir = config.direction || 'ltr'
    document.title = (config.title || 'Chat') + ' - Admin'

    // Reorder sections based on direction
    const container = document.querySelector('.container')
    const chatSection = document.querySelector('.chat-section')
    const siteSection = document.querySelector('.site-section')
    if (config.direction === 'ltr') {
        container.insertBefore(siteSection, chatSection)
    }

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

    // Set background image
    const bgImage = document.getElementById('bg-image')
    const bgReady = new Promise(r => { bgImage.onload = bgImage.onerror = r })
    bgImage.src = `/admin/assets/${config.backgroundImage || 'background.png'}`

    // Initialize chat widget
    window.ChatWidgetConfig = {
        targetElement: '#chat-section',
        canvasElement: '.site-section',
        ...(config.widget || {}),
        ...(window.ChatWidgetConfig || {})
    }

    // Load widget script
    const widgetScript = document.createElement('script')
    const widgetReady = new Promise(r => { widgetScript.onload = r })
    widgetScript.src = '/admin/widget.js'
    document.body.appendChild(widgetScript)

    // Hide spinner once ready
    await Promise.all([widgetReady, bgReady])
    const loader = document.getElementById('qabu-loader')
    if (loader) {
        loader.classList.add('hide')
        setTimeout(() => loader.remove(), 400)
    }
})()

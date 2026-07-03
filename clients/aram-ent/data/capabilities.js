let originalIframeSrc = null
const captureOriginal = (canvas) => {
  if (originalIframeSrc !== null) return
  const f = canvas && canvas.querySelector('iframe')
  originalIframeSrc = f ? f.src : ''
}
const swapIframe = (canvas, url) => {
  const f = canvas && canvas.querySelector('iframe')
  if (!f) return false
  f.style.transition = 'opacity 0.3s'
  f.style.opacity = '0'
  setTimeout(() => { f.src = url; f.style.opacity = '1' }, 300)
  return true
}

export default {

  REDIRECT_TO_DOCTOR: {
    description: 'Open a confirmation dialog offering to redirect the user to a specific doctor\'s dedicated Qabu assistant site. Use pipe-delimited args: slug|display_name|specialty (e.g. "|| REDIRECT_TO_DOCTOR drlipokatz|ד\"ר ליפו כץ|מומחית קטרקט ורשתית"). slug is the qabu.net subdomain. Before calling, tell the user in chat that you are about to move them over and briefly explain why that doctor fits. Use "|| SLEEP" before this capability to give the user time to read your message.',
    run: (args, canvas) => new Promise(resolve => {
      const [slug, name, specialty] = String(args).split('|').map(s => (s || '').trim())
      const targetUrl = `https://${slug}.qabu.net`

      const overlay = document.createElement('div')
      Object.assign(overlay.style, {
        position: 'absolute', inset: '0', zIndex: '100',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0)', transition: 'background 0.4s'
      })
      canvas.appendChild(overlay)
      requestAnimationFrame(() => overlay.style.background = 'rgba(0,0,0,0.5)')

      const card = document.createElement('div')
      card.dir = 'rtl'
      Object.assign(card.style, {
        background: '#fff', borderRadius: '16px', padding: '32px',
        width: '85%', maxWidth: '420px', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: '16px',
        opacity: '0', transform: 'translateY(30px)',
        transition: 'opacity 0.4s, transform 0.4s',
        textAlign: 'center'
      })
      requestAnimationFrame(() => {
        card.style.opacity = '1'
        card.style.transform = 'translateY(0)'
      })

      const title = document.createElement('h2')
      Object.assign(title.style, {
        margin: '0', fontSize: '22px', color: '#0F2C59'
      })
      title.textContent = `מעבר לעמוד של ${name}`
      card.appendChild(title)

      const body = document.createElement('p')
      Object.assign(body.style, {
        margin: '0', fontSize: '15px', color: '#333', lineHeight: '1.5'
      })
      body.textContent =
        `אעביר אותך לעוזר הייעודי של ${name}${specialty ? ` (${specialty})` : ''}. ` +
        `שם תוכל/י לקבל מענה מעמיק יותר ולקבוע תור ישירות. ממשיכים?`
      card.appendChild(body)

      const btnRow = document.createElement('div')
      Object.assign(btnRow.style, {
        display: 'flex', gap: '10px', marginTop: '8px'
      })

      const mkBtn = (text, primary) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = text
        Object.assign(b.style, {
          flex: '1', padding: '12px', borderRadius: '8px',
          fontSize: '16px', cursor: 'pointer', fontWeight: '600',
          fontFamily: 'inherit', transition: 'opacity 0.2s',
          border: primary ? 'none' : '2px solid #ccc',
          background: primary ? '#3276AA' : 'transparent',
          color: primary ? '#fff' : '#666'
        })
        b.onmouseenter = () => b.style.opacity = '0.85'
        b.onmouseleave = () => b.style.opacity = '1'
        return b
      }

      const goBtn = mkBtn('המשך', true)
      const backBtn = mkBtn('חזרה', false)
      btnRow.append(goBtn, backBtn)
      card.appendChild(btnRow)
      overlay.appendChild(card)

      const close = (result) => {
        card.style.opacity = '0'
        card.style.transform = 'translateY(30px)'
        overlay.style.background = 'rgba(0,0,0,0)'
        setTimeout(() => overlay.remove(), 400)
        resolve({ result, continue: false })
      }

      goBtn.onclick = () => {
        close('')
        setTimeout(() => { window.location.href = targetUrl }, 420)
      }
      backBtn.onclick = () => close(`The user declined the redirect to ${slug}.qabu.net`)
    })
  },

  SHOW_EXTERNAL_PAGE: {
    description: 'Subtly swap the iframe next to the chat to an external doctor\'s page (e.g. a doctor in the clinic who has a personal page on eintal.com but no dedicated Qabu assistant). Does NOT navigate the user away. Use when the user asks about a topic matching a doctor that has a KB entry tagged [EXTURL:...]. Args are pipe-delimited: url|display_name|specialty. No confirmation modal is shown — be subtle. Before calling, say one short sentence like "אציג לך את עמוד של ..." and use "|| SLEEP 1500" before this action so the sentence lands first.',
    run: (args, canvas) => {
      const [url] = String(args).split('|').map(s => (s || '').trim())
      captureOriginal(canvas)
      swapIframe(canvas, url)
      return Promise.resolve({ result: '', continue: true })
    }
  },

  RESET_PAGE: {
    description: 'Restore the iframe to the clinic\'s own page. Use when the user indicates they are no longer interested in the external doctor whose page is currently shown (e.g. "לא, הוא לא מתאים לי", "משהו אחר בבקשה", or a topic change). No args. Use "|| SLEEP 1500" before this action to let the preceding chat message land first.',
    run: (_args, canvas) => {
      if (originalIframeSrc !== null) swapIframe(canvas, originalIframeSrc)
      return Promise.resolve({ result: '', continue: true })
    }
  },

  SLEEP: {
    description: 'Wait for a specified duration before continuing. The duration is in milliseconds. Example:\n|| ACTIONS\n|| SLEEP 2500\nWill wait 2.5 seconds.',
    run: (ms) => new Promise(r => setTimeout(r, +ms, { result: '', continue: true }))
  }
}

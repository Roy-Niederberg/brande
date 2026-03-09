export default {


  CONTACT_FORM: {
    description: 'Open a UI dialog with a contact details form for the user to fill in. The fields are name, email, and phone. Before using this capability, tell the user you are opening a form and ask them to provide their contact information. Give them time to read your message (proportional to its length) — use "|| SLEEP" before calling this capability.',
    run: (args, canvas) => new Promise(resolve => {
      const dir = document.documentElement.dir || 'ltr'

      const overlay = document.createElement('div')
      Object.assign(overlay.style, {
        position: 'absolute', inset: '0', zIndex: '100',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0)', transition: 'background 0.4s'
      })
      canvas.appendChild(overlay)
      requestAnimationFrame(() => overlay.style.background = 'rgba(0,0,0,0.5)')

      const card = document.createElement('form')
      card.dir = dir
      Object.assign(card.style, {
        background: '#fff', borderRadius: '16px', padding: '32px',
        width: '85%', maxWidth: '400px', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: '16px',
        opacity: '0', transform: 'translateY(30px)',
        transition: 'opacity 0.4s, transform 0.4s'
      })
      requestAnimationFrame(() => {
        card.style.opacity = '1'
        card.style.transform = 'translateY(0)'
      })

      const title = document.createElement('h2')
      Object.assign(title.style, {
        margin: '0', fontSize: '22px', color: '#0F2C59', textAlign: 'center'
      })
      title.textContent = 'Contact Details'
      card.appendChild(title)

      const fields = [
        { name: 'name',  label: 'Full Name', type: 'text',  required: true },
        { name: 'email', label: 'Email',     type: 'email', required: true },
        { name: 'phone', label: 'Phone',     type: 'tel' }
      ]
      const inputs = {}

      fields.forEach((f, i) => {
        const wrap = document.createElement('div')
        Object.assign(wrap.style, {
          display: 'flex', flexDirection: 'column', gap: '4px',
          opacity: '0', transform: 'translateY(10px)',
          transition: 'opacity 0.3s, transform 0.3s',
          transitionDelay: `${0.15 + i * 0.08}s`
        })
        requestAnimationFrame(() => {
          wrap.style.opacity = '1'
          wrap.style.transform = 'translateY(0)'
        })
        const label = document.createElement('label')
        Object.assign(label.style, {
          fontSize: '14px', color: '#333', fontWeight: '500'
        })
        label.textContent = f.label + (f.required ? ' *' : '')

        const inp = document.createElement('input')
        inp.type = f.type || 'text'
        inp.name = f.name
        inp.required = !!f.required
        inp.dir = 'auto'
        Object.assign(inp.style, {
          padding: '10px 14px', border: '2px solid #ddd',
          borderRadius: '8px', fontSize: '16px', outline: 'none',
          transition: 'border-color 0.2s', fontFamily: 'inherit'
        })
        inp.onfocus = () => inp.style.borderColor = '#3276AA'
        inp.onblur = () => inp.style.borderColor = '#ddd'

        inputs[f.name] = inp
        wrap.append(label, inp)
        card.appendChild(wrap)
      })

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

      const submitBtn = mkBtn('Send', true)
      const cancelBtn = mkBtn('Cancel', false)
      if (dir === 'rtl') btnRow.append(cancelBtn, submitBtn)
      else btnRow.append(submitBtn, cancelBtn)
      card.appendChild(btnRow)
      overlay.appendChild(card)

      const close = (result, cont) => {
        card.style.opacity = '0'
        card.style.transform = 'translateY(30px)'
        overlay.style.background = 'rgba(0,0,0,0)'
        setTimeout(() => overlay.remove(), 400)
        resolve({ result, continue: cont })
      }

      submitBtn.onclick = () => {
        if (!card.reportValidity()) return
        const d = {}
        for (const [k, inp] of Object.entries(inputs)) d[k] = inp.value.trim()
        close(`User submitted contact form — Name: ${d.name}, Email: ${d.email}, Phone: ${d.phone || 'not provided'}`, false)
      }
      cancelBtn.onclick = () => close('User declined to fill the contact form', false)
    })
  },

  SLEEP: {
    description: 'Wait for a specified duration before continuing. The duration is in milliseconds. Example:\n|| ACTIONS\n|| SLEEP 2500\nWill wait 2.5 seconds.',
    run: (ms) => new Promise(r => setTimeout(r, +ms, {result: '', continue: true}))
  }
}

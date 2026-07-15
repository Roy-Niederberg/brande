---
name: verify
description: How to verify UI/widget/shared-shell changes end-to-end in the QA environment with a headless browser.
---

# Verifying UI changes in QA

## Launch

```sh
cd qa && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Dev overlay mounts `services/admin/src` (incl. `views/`) into the admin
containers; admin copies `views/` → the `ui` volume on **startup**, so the site
serves loader/index edits after a fresh `up`. Widget files (`widget.js`,
`widget.css`) are **baked into the image** — rebuild after editing:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build drlipokatz-widget dradamblack-widget
```

Surfaces: `http://drlipokatz.qa.qabu.net:8443` (Hebrew/RTL),
`http://dradamblack.qa.qabu.net:8443` (English/LTR), main at
`http://qa.qabu.net:8080`. Confirm an edit is live with
`curl -s http://drlipokatz.qa.qabu.net:8443/loader.js | grep <marker>`.

## Drive

No browsers in Docker; the host has `/usr/bin/firefox` and node (nvm). Use
puppeteer-core with Firefox from the scratchpad (never `npm install` inside the
repo — Docker-only philosophy):

```js
const puppeteer = require('puppeteer-core')
const browser = await puppeteer.launch({ browser: 'firefox',
  executablePath: '/usr/bin/firefox', headless: true,
  defaultViewport: { width: 1440, height: 900 } })
```

Gotchas:
- Ignore `SecurityError: ... "__bidi_args" on cross-origin object` pageerrors —
  puppeteer/BiDi noise from the cross-origin site iframe, not app errors.
- Wait for `#chat-widget` (embedded) or `#chat-launcher` (floating), then
  ~2-3s more for the greeting typewriter before screenshots.
- Always drive **both** drlipokatz (RTL) and dradamblack (LTR) — direction
  bugs are the house specialty — and probe a mobile viewport (390x844);
  the widget switches to fullscreen ≤480px.
- Admin (`/bab/admin/`) needs Google OAuth — usually skip it and say so.

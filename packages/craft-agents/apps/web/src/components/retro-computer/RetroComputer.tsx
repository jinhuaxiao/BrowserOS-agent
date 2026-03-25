'use client'

import { useEffect, useRef, useState } from 'react'
import './retro-computer.css'

const TYPING_SNIPPETS = [
  [
    '$ craft profile create --name "shop-uk"',
    '  Fingerprint: Chrome/131 · macOS 14',
    '  Proxy: London (GB) · residential',
    '  Status: ready',
    '',
    '$ craft profile launch shop-uk',
    '  Launching browser...',
    '  Connected to proxy 185.xxx.xx.12',
    '  Session active.',
  ],
  [
    '$ craft proxy pool add \\',
    '    --provider luminati \\',
    '    --geo US,GB,DE',
    '  Added 50 proxies to pool "europe"',
    '',
    '$ craft profile list --team',
    '  shop-uk     active   London',
    '  shop-de     idle     Berlin',
    '  ads-us-01   active   New York',
  ],
  [
    '$ craft agent run --skill scraper \\',
    '    --profile shop-uk',
    '  Agent connected to profile',
    '  Running skill: product-scraper',
    '  Collected 142 items',
    '  Saved to ./data/products.json',
    '',
    '$ craft team invite alice@co.com',
    '  Invite sent. Role: operator',
  ],
]

function TypingAnimation() {
  const [snippetIdx, setSnippetIdx] = useState(0)
  const [text, setText] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const snippet = TYPING_SNIPPETS[snippetIdx]
    const fullText = snippet.join('\n')
    let charIdx = 0

    function typeNext() {
      if (charIdx <= fullText.length) {
        setText(fullText.slice(0, charIdx))
        charIdx++
        const char = fullText[charIdx - 1]
        const delay = char === '\n' ? 200 : char === ' ' ? 30 : 40
        timeoutRef.current = setTimeout(typeNext, delay)
      } else {
        timeoutRef.current = setTimeout(() => {
          setSnippetIdx((prev) => (prev + 1) % TYPING_SNIPPETS.length)
        }, 3000)
      }
    }

    typeNext()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [snippetIdx])

  return (
    <div className="typing-container">
      <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
      <span className="cursor" />
    </div>
  )
}

export default function RetroComputer() {
  return (
    <div className="visual-panel">
      <div className="organic-blob" />
      <div className="scene">
        <div className="computer-unit">
          {/* Front face */}
          <div className="face front">
            <div className="screen-inset">
              <div className="crt">
                <div className="crt-glow" />
                <div className="crt-ui">
                  <div className="crt-sidebar">
                    <div className="crt-sidebar-item active">
                      <span className="crt-icon-dot green" />
                      Profiles
                    </div>
                    <div className="crt-sidebar-item">
                      <span className="crt-icon-dot orange" />
                      Proxies
                    </div>
                    <div className="crt-sidebar-item">
                      <span className="crt-icon-dot blue" />
                      Team
                    </div>
                    <div className="crt-sidebar-item">
                      <span className="crt-icon-dot" />
                      Agent
                    </div>
                  </div>
                  <div className="crt-main-area">
                    <div className="crt-os-label">Craft Agents v1.0</div>
                    <div className="crt-window">
                      <div className="crt-window-header">
                        <span>terminal</span>
                        <span>[x]</span>
                      </div>
                      <TypingAnimation />
                    </div>
                    <div className="crt-status-bar">
                      <span>3 profiles active</span>
                      <span>proxy: ok</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="floppy-slot" />
            <div className="sticker sticker-1">CA</div>
            <div className="sticker sticker-2">AI</div>
            <div className="vent-grid">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="vent" />
              ))}
            </div>
          </div>

          {/* Other faces */}
          <div className="face back" />
          <div className="face left" />
          <div className="face right" />
          <div className="face top" />
          <div className="face bottom" />

          {/* Keyboard */}
          <div className="keyboard-assembly">
            <div className="kb-base" />
            <div className="kb-front" />
            <div className="kb-shadow" />
            <div className="keys-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`r1-${i}`} className="key" />
              ))}
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`r2-${i}`} className="key" />
              ))}
              <div className="key wide" />
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={`r3-${i}`} className="key" />
              ))}
              <div className="key" />
              <div className="key" />
              <div className="key space" />
              <div className="key" />
              <div className="key" />
              <div className="key wide" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

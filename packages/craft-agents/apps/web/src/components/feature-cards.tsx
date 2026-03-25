'use client'

import { useRef, useEffect } from 'react'
import './browseros-styles.css'

/* ═══ Canvas Animation Hooks (extracted from browseros.com) ═══ */

function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const s = canvasRef.current
    if (!s) return
    const a = s.getContext('2d')
    if (!a) return
    let n: number
    let r: { x: number; y: number; vx: number; vy: number }[] = []

    function init() {
      if (!s) return
      const l = s.parentElement
      if (l) {
        s.width = l.clientWidth
        s.height = l.clientHeight
        r = []
        for (let p = 0; p < 30; p++)
          r.push({ x: Math.random() * s.width, y: Math.random() * s.height, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5 })
      }
    }

    function draw() {
      if (!s || !a) return
      a.clearRect(0, 0, s.width, s.height)
      a.fillStyle = '#5B7553'
      a.strokeStyle = '#5B7553'
      for (const l of r) {
        l.x += l.vx; l.y += l.vy
        if (l.x < 0 || l.x > s.width) l.vx *= -1
        if (l.y < 0 || l.y > s.height) l.vy *= -1
        a.beginPath(); a.arc(l.x, l.y, 2, 0, Math.PI * 2); a.fill()
        for (const p of r) {
          const d = l.x - p.x, c = l.y - p.y, h = Math.sqrt(d * d + c * c)
          if (h < 100) {
            a.beginPath(); a.moveTo(l.x, l.y); a.lineTo(p.x, p.y)
            a.globalAlpha = 1 - h / 100; a.stroke(); a.globalAlpha = 1
          }
        }
      }
      n = requestAnimationFrame(draw)
    }

    init(); draw()
    window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(n); window.removeEventListener('resize', init) }
  }, [canvasRef])
}

function useMatrixRain(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const s = canvasRef.current
    if (!s) return
    const a = s.getContext('2d')
    if (!a) return
    const chars = '01'
    let drops: number[] = []
    const fontSize = 14
    let raf: number

    function init() {
      if (!s?.parentElement) return
      s.width = s.parentElement.clientWidth
      s.height = s.parentElement.clientHeight
      const cols = s.width / fontSize
      drops = []
      for (let h = 0; h < cols; h++) drops[h] = 1
    }

    function draw() {
      if (!s || !a) return
      a.fillStyle = 'rgba(237, 233, 218, 0.15)'
      a.fillRect(0, 0, s.width, s.height)
      a.fillStyle = '#7B6B8A'
      a.font = `${fontSize}px monospace`
      for (let d = 0; d < drops.length; d++) {
        const c = chars.charAt(Math.floor(Math.random() * chars.length))
        a.fillText(c, d * fontSize, drops[d] * fontSize)
        if (drops[d] * fontSize > s.height && Math.random() > 0.975) drops[d] = 0
        drops[d]++
      }
      raf = requestAnimationFrame(draw)
    }

    init(); draw()
    window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [canvasRef])
}

function useOrbitEllipses(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const s = canvasRef.current
    if (!s) return
    const a = s.getContext('2d')
    if (!a) return
    let angle = 0, raf: number

    function init() {
      if (!s?.parentElement) return
      s.width = s.parentElement.clientWidth
      s.height = s.parentElement.clientHeight
    }

    function draw() {
      if (!s || !a) return
      a.clearRect(0, 0, s.width, s.height)
      const cx = s.width / 2, cy = s.height / 2
      a.strokeStyle = '#B5764A'; a.lineWidth = 1
      for (let v = 0; v < 5; v++) {
        a.beginPath(); a.ellipse(cx, cy, 60 + v * 30, 30 + v * 15, angle + v, 0, Math.PI * 2); a.stroke()
      }
      const r = 120
      const px = cx + Math.cos(angle * 2) * r, py = cy + Math.sin(angle * 2) * (r * 0.5)
      a.fillStyle = '#0f0f0f'; a.beginPath(); a.arc(px, py, 6, 0, Math.PI * 2); a.fill()
      angle += 0.01; raf = requestAnimationFrame(draw)
    }

    init(); draw()
    window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [canvasRef])
}

function useWaveLines(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const s = canvasRef.current
    if (!s) return
    const a = s.getContext('2d')
    if (!a) return
    let t = 0, raf: number

    function init() {
      if (!s?.parentElement) return
      s.width = s.parentElement.clientWidth
      s.height = s.parentElement.clientHeight
    }

    function draw() {
      if (!s || !a) return
      a.clearRect(0, 0, s.width, s.height)
      a.lineWidth = 2
      const colors = ['#8A5A44', '#7B6B8A', '#5B7553']
      for (let p = 0; p < 3; p++) {
        a.strokeStyle = colors[p]; a.beginPath()
        for (let d = 0; d < s.width; d++) {
          const y = s.height / 2 + Math.sin(d * 0.01 + t + p) * 40 * Math.sin(t * 0.5)
          d === 0 ? a.moveTo(d, y) : a.lineTo(d, y)
        }
        a.stroke()
      }
      t += 0.05; raf = requestAnimationFrame(draw)
    }

    init(); draw()
    window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [canvasRef])
}

function useEqualizer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const s = canvasRef.current
    if (!s) return
    const a = s.getContext('2d')
    if (!a) return
    const n = 20, heights = new Array(n).fill(0)
    let raf: number

    function init() {
      if (!s?.parentElement) return
      s.width = s.parentElement.clientWidth
      s.height = s.parentElement.clientHeight
    }

    function draw() {
      if (!s || !a) return
      a.clearRect(0, 0, s.width, s.height)
      const w = s.width / n
      a.fillStyle = '#0f0f0f'
      for (let d = 0; d < n; d++) {
        const target = Math.random() * s.height * 0.8
        heights[d] += (target - heights[d]) * 0.1
        a.fillRect(d * w, s.height - heights[d], w - 2, heights[d])
      }
      raf = requestAnimationFrame(draw)
    }

    init(); draw()
    window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [canvasRef])
}

/* ═══ Canvas Card Wrapper ═══ */
function CanvasCard({ hook, children }: { hook: (ref: React.RefObject<HTMLCanvasElement | null>) => void; children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  hook(canvasRef)
  return (
    <>
      <canvas ref={canvasRef} className="canvas-overlay" />
      {children}
    </>
  )
}

/* ═══ Bracket Corner Decoration ═══ */
function BracketCorners() {
  const style = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', width: 16, height: 16,
    borderColor: 'rgba(15,15,15,0.3)', transition: 'width 0.4s, height 0.4s, opacity 0.4s',
    opacity: 0, ...pos,
  })
  return (
    <>
      <div className="bracket-corner" style={style({ top: 12, left: 12, borderTop: '2px solid', borderLeft: '2px solid' })} />
      <div className="bracket-corner" style={style({ top: 12, right: 12, borderTop: '2px solid', borderRight: '2px solid' })} />
      <div className="bracket-corner" style={style({ bottom: 12, left: 12, borderBottom: '2px solid', borderLeft: '2px solid' })} />
      <div className="bracket-corner" style={style({ bottom: 12, right: 12, borderBottom: '2px solid', borderRight: '2px solid' })} />
    </>
  )
}

/* Sticky note overlay */
function StickyNote({ bg, rotate, style, children }: { bg: string; rotate: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className="sticky-note" style={{ position: 'absolute', zIndex: 10, transform: `rotate(${rotate})`, backgroundColor: bg, ...style }}>
      <div className="sticky-note-pin" />
      {children}
    </div>
  )
}

/* ═══ Main Component ═══ */
export default function FeatureCards() {
  return (
    <div className="feature-grid">
      {/* Card 01: Fingerprints (8col × 2row) — Particles */}
      <button type="button" className="feature-card-animated span-8 row-2" style={{ minHeight: 520 }}>
        <CanvasCard hook={useParticles}>
          <BracketCorners />

          <StickyNote bg="#C5CEBD" rotate="-2deg" style={{ top: '10%', left: '6%' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>UNIQUE FINGERPRINTS</p>
            <p className="sticky-note-sub">CANVAS, WEBGL, AUDIO & MORE</p>
          </StickyNote>

          <StickyNote bg="#D4C5A0" rotate="1.5deg" style={{ top: '6%', right: '12%' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>ANTI-DETECTION</p>
            <p className="sticky-note-sub">CHROMIUM-LEVEL STEALTH</p>
          </StickyNote>

          <div className="play-indicator" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 15 }}>
            <div className="play-indicator-circle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="8,5 20,12 8,19" /></svg>
            </div>
            <span className="play-label">CLICK FOR VIDEO</span>
          </div>

          <div className="card-content">
            <div />
            <div className="card-header" style={{ marginTop: 'auto' }}>
              <span className="mono-label" style={{ color: '#5B7553', fontSize: 11, display: 'block', marginBottom: 4 }}>01 // STEALTH</span>
              <h3>Unique Fingerprints for Every Profile</h3>
              <p>Each browser profile runs with a distinct, hardware-level fingerprint — Canvas, WebGL, audio, fonts, and 50+ signals. All generated at Chromium level. Passes every detection test. No extensions, no patches. Privacy-first.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <span className="card-badge">CHROMIUM-LEVEL</span>
                <span className="card-badge">UNDETECTABLE</span>
              </div>
            </div>
          </div>
        </CanvasCard>
      </button>

      {/* Card 02: AI Agent (4col × 2row) — Matrix Rain */}
      <button type="button" className="feature-card-animated span-4 row-2" style={{ minHeight: 520 }}>
        <CanvasCard hook={useMatrixRain}>
          <BracketCorners />

          <StickyNote bg="#D4C5A0" rotate="1deg" style={{ top: '5%', right: '8%' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>BRING YOUR LLM</p>
            <p className="sticky-note-sub">LOCAL OR CLOUD</p>
          </StickyNote>

          <div className="play-indicator" style={{ position: 'absolute', top: '15%', right: '10%', zIndex: 15 }}>
            <div className="play-indicator-circle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="8,5 20,12 8,19" /></svg>
            </div>
            <span className="play-label">CLICK FOR VIDEO</span>
          </div>

          <div className="card-content">
            <div />
            <div className="card-header" style={{ marginTop: 'auto' }}>
              <span className="mono-label" style={{ color: '#7B6B8A', fontSize: 11, display: 'block', marginBottom: 4 }}>02 // AI AGENT</span>
              <h3>Bring your own AI</h3>
              <p>Use Kimi K2.5, Claude Opus 4.6, or Gemini 3 as the driver in your agent. Summarize articles, draft replies, and get answers — without switching tabs.</p>
              <div style={{ marginTop: 20, fontFamily: "'Space Mono', monospace", fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                  <span style={{ fontWeight: 500 }}>3 models active</span>
                </div>
                <div style={{ color: '#888', marginLeft: 14 }}>&gt; GPT-4.1: ready</div>
                <div style={{ color: '#888', marginLeft: 14 }}>&gt; Gemini 2.5: ready</div>
                <div style={{ color: '#888', marginLeft: 14 }}>&gt; Claude Sonnet 4.5: ready</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <span className="card-badge">MCP SERVER</span>
                <span className="card-badge">MULTI-LLM</span>
              </div>
            </div>
          </div>
        </CanvasCard>
      </button>

      {/* Card 03: Proxy — Orbit Ellipses */}
      <button type="button" className="feature-card-animated span-4">
        <CanvasCard hook={useOrbitEllipses}>
          <BracketCorners />
          <div className="card-content">
            <div />
            <div className="card-header" style={{ marginTop: 'auto' }}>
              <span className="mono-label" style={{ color: '#B5764A', fontSize: 11, display: 'block', marginBottom: 4 }}>03 // NETWORK</span>
              <h3>Smart Proxy Pool</h3>
              <p>Built-in proxy pool management with geo-targeting. Assign residential, datacenter, or mobile proxies to profiles. Health checks and auto-rotation.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <span className="card-badge">GEO-TARGETING</span>
                <span className="card-badge">AUTO-ROTATE</span>
              </div>
            </div>
          </div>
        </CanvasCard>
      </button>

      {/* Card 04: Team — Wave Lines */}
      <button type="button" className="feature-card-animated span-4">
        <CanvasCard hook={useWaveLines}>
          <BracketCorners />
          <div className="card-content">
            <div />
            <div className="card-header" style={{ marginTop: 'auto' }}>
              <span className="mono-label" style={{ color: '#8A5A44', fontSize: 11, display: 'block', marginBottom: 4 }}>04 // TEAM</span>
              <h3>Team Collaboration</h3>
              <p>Share profiles with your team. Role-based access control, activity logs, and real-time sync. Everyone works on the same profiles without conflicts.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <span className="card-badge">RBAC</span>
                <span className="card-badge">AUDIT LOGS</span>
              </div>
            </div>
          </div>
        </CanvasCard>
      </button>

      {/* Card 05: MCP Server — Equalizer */}
      <button type="button" className="feature-card-animated span-4">
        <CanvasCard hook={useEqualizer}>
          <BracketCorners />
          <div className="card-content">
            <div />
            <div className="card-header" style={{ marginTop: 'auto' }}>
              <span className="mono-label" style={{ color: '#0f0f0f', fontSize: 11, display: 'block', marginBottom: 4 }}>05 // DEV</span>
              <h3>MCP Server Built-in</h3>
              <p>Craft Agents comes pre-installed with an MCP server. Connect it to Claude Code, Gemini CLI, or Codex — automate browser profiles right from the terminal.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <span className="card-badge">CLAUDE CODE</span>
                <span className="card-badge">GEMINI CLI</span>
              </div>
            </div>
          </div>
        </CanvasCard>
      </button>
    </div>
  )
}

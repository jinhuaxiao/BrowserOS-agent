'use client'

import './browseros-styles.css'

/* Constellation dots SVG — connects elements visually */
function ConstellationSVG() {
  const dots = [
    [60,30],[180,80],[320,45],[450,120],[550,60],[680,140],
    [120,200],[280,260],[400,180],[520,300],[650,240],[100,340],
    [350,380],[500,420],[700,350],[200,440],[600,480],[750,100],[30,150],[770,420],
  ]
  const lines = [[0,1],[1,2],[2,4],[3,4],[4,5],[6,7],[7,8],[8,3],[9,10],[10,5],[11,6],[12,9],[13,14],[7,12],[15,12],[16,14],[1,8],[3,10]]
  return (
    <svg className="canvas-overlay" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.35 }}>
      {lines.map(([a, b], i) => (
        <line key={i} x1={dots[a][0]} y1={dots[a][1]} x2={dots[b][0]} y2={dots[b][1]} stroke="#c5c2bc" strokeWidth="0.8" strokeDasharray="4,4" />
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d[0]} cy={d[1]} r="3.5" fill="#c5c2bc" />
      ))}
    </svg>
  )
}

function StickyNote({ bg, rotate, style, children }: { bg: string; rotate: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className="sticky-note" style={{ position: 'absolute', zIndex: 10, transform: `rotate(${rotate})`, backgroundColor: bg, ...style }}>
      <div className="sticky-note-pin" />
      {children}
    </div>
  )
}

export default function FeatureCards() {
  return (
    <div className="feature-grid">
      {/* ── Card 01: Fingerprints (8 col × 2 row) ── */}
      <button type="button" className="feature-card-animated span-8 row-2" style={{ minHeight: 520 }}>
        <ConstellationSVG />

        <StickyNote bg="#C5CEBD" rotate="-2deg" style={{ top: '10%', left: '6%' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>UNIQUE FINGERPRINTS</p>
          <p className="sticky-note-sub">CANVAS, WEBGL, AUDIO & MORE</p>
        </StickyNote>

        <StickyNote bg="#D4C5A0" rotate="1.5deg" style={{ top: '6%', right: '12%' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>ANTI-DETECTION</p>
          <p className="sticky-note-sub">CHROMIUM-LEVEL STEALTH</p>
        </StickyNote>

        {/* Play button */}
        <div className="play-indicator" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 15, opacity: 0.8 }}>
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
            <p>
              Each browser profile runs with a distinct, hardware-level fingerprint — Canvas, WebGL, audio, fonts, and 50+ signals.
              All generated at Chromium level. Passes every detection test. No extensions, no patches. Privacy-first.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <span className="card-badge">CHROMIUM-LEVEL</span>
              <span className="card-badge">UNDETECTABLE</span>
            </div>
          </div>
        </div>
      </button>

      {/* ── Card 02: AI Agent (4 col × 2 row) ── */}
      <button type="button" className="feature-card-animated span-4 row-2" style={{ minHeight: 520 }}>
        <StickyNote bg="#D4C5A0" rotate="1deg" style={{ top: '5%', right: '8%' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>BRING YOUR LLM</p>
          <p className="sticky-note-sub">LOCAL OR CLOUD</p>
        </StickyNote>

        <div className="card-content">
          <div />
          <div className="card-header" style={{ marginTop: 'auto' }}>
            <span className="mono-label" style={{ color: '#7B6B8A', fontSize: 11, display: 'block', marginBottom: 4 }}>02 // AI AGENT</span>
            <h3>Bring your own AI</h3>
            <p>
              Use Kimi K2.5, Claude Opus 4.6, or Gemini 3 as the driver in your agent.
              Summarize articles, draft replies, and get answers — without switching tabs.
            </p>

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
      </button>

      {/* ── Card 03: Proxy Pool ── */}
      <button type="button" className="feature-card-animated span-4">
        <div className="card-content">
          <div />
          <div className="card-header" style={{ marginTop: 'auto' }}>
            <span className="mono-label" style={{ color: '#B5764A', fontSize: 11, display: 'block', marginBottom: 4 }}>03 // NETWORK</span>
            <h3>Smart Proxy Pool</h3>
            <p>
              Built-in proxy pool management with geo-targeting. Assign residential, datacenter, or mobile proxies to profiles.
              Health checks and auto-rotation included.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <span className="card-badge">GEO-TARGETING</span>
              <span className="card-badge">AUTO-ROTATE</span>
            </div>
          </div>
        </div>
      </button>

      {/* ── Card 04: Team ── */}
      <button type="button" className="feature-card-animated span-4">
        <div className="card-content">
          <div />
          <div className="card-header" style={{ marginTop: 'auto' }}>
            <span className="mono-label" style={{ color: '#8A5A44', fontSize: 11, display: 'block', marginBottom: 4 }}>04 // TEAM</span>
            <h3>Team Collaboration</h3>
            <p>
              Share profiles with your team. Role-based access control, activity logs, and real-time sync.
              Everyone works on the same profiles without conflicts.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <span className="card-badge">RBAC</span>
              <span className="card-badge">AUDIT LOGS</span>
            </div>
          </div>
        </div>
      </button>

      {/* ── Card 05: MCP Server ── */}
      <button type="button" className="feature-card-animated span-4">
        <div className="card-content">
          <div />
          <div className="card-header" style={{ marginTop: 'auto' }}>
            <span className="mono-label" style={{ color: '#0f0f0f', fontSize: 11, display: 'block', marginBottom: 4 }}>05 // DEV</span>
            <h3>MCP Server Built-in</h3>
            <p>
              Craft Agents comes pre-installed with an MCP server. Connect it to Claude Code, Gemini CLI,
              or Codex — automate browser profiles right from the terminal.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <span className="card-badge">CLAUDE CODE</span>
              <span className="card-badge">GEMINI CLI</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

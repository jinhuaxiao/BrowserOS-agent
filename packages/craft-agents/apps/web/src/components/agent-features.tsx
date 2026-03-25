'use client'

import './browseros-styles.css'

const CARDS = [
  {
    tag: 'AGENT', tagColor: '#5B7553', title: 'Skills',
    desc: 'Steer agent behavior with reusable instructions written in plain Markdown. Comes pre-installed with 12 skills — Deep Research, Form Fill, Data Extract, and more. Create your own or customize the built-ins.',
    badges: 'PRE-INSTALLED / CUSTOM / REUSABLE',
    bg: '#F5F0E0',
    pos: { left: '2%', top: '8%' },
    size: { width: 340, height: 420 },
    rotate: '-3deg',
    pin: false,
  },
  {
    tag: 'AGENT', tagColor: '#7B6B8A', title: 'SOUL.md',
    desc: "Define your agent's personality, values, and communication style in a single Markdown file. Every session starts by reading its soul — so it always knows who it is and how to behave.",
    badges: 'PERSONALITY / VALUES / STYLE',
    bg: '#FFFFFF',
    pos: { left: '28%', top: '0%' },
    size: { width: 300, height: 360 },
    rotate: '1.5deg',
    pin: true,
    pinColor: '#C8885A',
  },
  {
    tag: 'AUTOMATION', tagColor: '#B5764A', title: 'Scheduled Tasks',
    desc: 'Set any task to run on autopilot. Daily, hourly, or every few minutes. Runs in a hidden window so it never interrupts your work. Results appear on your New Tab page.',
    badges: 'DAILY / HOURLY / MINUTES',
    bg: '#F0EDE4',
    pos: { left: '52%', top: '12%' },
    size: { width: 280, height: 320 },
    rotate: '-1deg',
    pin: false,
  },
  {
    tag: 'YOU', tagColor: '#7B6B8A', title: 'Suggest your feature',
    desc: 'What feature would you like to see in Craft Agents? Join our Discord and let us know.',
    badges: 'SUGGESTED FEATURES',
    bg: '#D8E4D0',
    pos: { left: '74%', top: '8%' },
    size: { width: 260, height: 300 },
    rotate: '2deg',
    pin: false,
  },
  {
    tag: 'AGENT', tagColor: '#8A5A44', title: 'Agent Memory',
    desc: 'Your agent remembers context across sessions — preferences, past decisions, running notes. All stored locally as plain files you can read and edit. Memory that you own.',
    badges: 'PERSISTENT / LOCAL / EDITABLE',
    bg: '#F5F0E0',
    pos: { left: '8%', top: '58%' },
    size: { width: 320, height: 340 },
    rotate: '-2deg',
    pin: true,
    pinColor: '#D4A574',
  },
  {
    tag: 'POWER', tagColor: '#5B7553', title: 'Filesystem Access',
    desc: 'Give the agent access to a local folder. Research the web and save reports. Read spreadsheets and fill forms. Run shell commands — all sandboxed to the folder you choose.',
    badges: 'READ / WRITE / RUN',
    highlight: 'SANDBOXED',
    bg: '#FFFFFF',
    pos: { left: '36%', top: '52%' },
    size: { width: 320, height: 320 },
    rotate: '0.5deg',
    pin: true,
    pinColor: '#7B9B8A',
  },
]

/* Constellation crosshair dots */
function CrosshairDots() {
  const points = [
    [48, 6], [53, 32], [26, 50], [72, 48],
    [38, 72], [62, 78], [15, 28], [85, 22],
    [50, 55], [30, 88], [70, 92], [90, 60],
  ]
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.2 }}>
      {points.map((p, i) => (
        <g key={i}>
          <line x1={`${p[0] - 0.6}%`} y1={`${p[1]}%`} x2={`${p[0] + 0.6}%`} y2={`${p[1]}%`} stroke="#b5b0a5" strokeWidth="1" />
          <line x1={`${p[0]}%`} y1={`${p[1] - 0.8}%`} x2={`${p[0]}%`} y2={`${p[1] + 0.8}%`} stroke="#b5b0a5" strokeWidth="1" />
        </g>
      ))}
    </svg>
  )
}

function Pin({ color }: { color: string }) {
  return (
    <div style={{
      position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
      width: 16, height: 16, zIndex: 20,
    }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${color}, ${color}cc)`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        margin: '0 auto',
      }} />
    </div>
  )
}

export default function AgentFeatures() {
  return (
    <div style={{ position: 'relative', minHeight: 700, maxWidth: 1100, margin: '0 auto' }}>
      <CrosshairDots />

      {CARDS.map((card) => (
        <div
          key={card.title}
          style={{
            position: 'absolute',
            ...card.pos,
            width: card.size.width,
            minHeight: card.size.height,
            backgroundColor: card.bg,
            transform: `rotate(${card.rotate})`,
            padding: '28px 28px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.4s, box-shadow 0.4s',
            cursor: 'default',
            zIndex: card.pin ? 5 : 3,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = `rotate(${card.rotate}) translateY(-4px)`
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)'
            e.currentTarget.style.zIndex = '20'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = `rotate(${card.rotate})`
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)'
            e.currentTarget.style.zIndex = card.pin ? '5' : '3'
          }}
        >
          {card.pin && <Pin color={card.pinColor || '#C8885A'} />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: card.tagColor, display: 'inline-block' }} />
              <span className="font-space" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#888' }}>
                {card.tag}
              </span>
            </div>
            {card.highlight && (
              <span className="card-badge" style={{ fontSize: 9 }}>{card.highlight}</span>
            )}
          </div>

          <h3 className="font-heading" style={{ fontSize: 24, fontWeight: 400, margin: 0, color: '#1a1a1a' }}>
            {card.title}
          </h3>

          <p style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 14, lineHeight: 1.55, color: '#555',
            flex: 1, margin: 0,
          }}>
            {card.desc}
          </p>

          <div className="font-space" style={{
            fontSize: 9, letterSpacing: '0.05em',
            textTransform: 'uppercase' as const, color: '#999',
            marginTop: 'auto',
          }}>
            {card.badges}
          </div>
        </div>
      ))}

      <div className="font-space" style={{
        position: 'absolute', bottom: 0, right: 0,
        fontSize: 11, letterSpacing: '0.1em',
        textTransform: 'uppercase' as const, color: '#aaa',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
        </svg>
        TRY MOVING AROUND THE CARDS
      </div>
    </div>
  )
}

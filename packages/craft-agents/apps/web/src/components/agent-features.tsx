'use client'

import './browseros-styles.css'

const CARDS = [
  {
    tag: 'AGENT', tagColor: '#5B7553', title: 'Skills',
    desc: 'Steer agent behavior with reusable instructions written in plain Markdown. Comes pre-installed with 12 skills — Deep Research, Form Fill, Data Extract, and more. Create your own or customize the built-ins.',
    badges: 'PRE-INSTALLED / CUSTOM / REUSABLE',
    grid: { column: '1 / span 4', row: '1 / span 2' },
  },
  {
    tag: 'AGENT', tagColor: '#7B6B8A', title: 'SOUL.md',
    desc: "Define your agent's personality, values, and communication style in a single Markdown file. Every session starts by reading its soul — so it always knows who it is and how to behave.",
    badges: 'PERSONALITY / VALUES / STYLE',
    grid: { column: '5 / span 4', row: '1 / span 2' },
  },
  {
    tag: 'AUTOMATION', tagColor: '#B5764A', title: 'Scheduled Tasks',
    desc: 'Set any task to run on autopilot. Daily, hourly, or every few minutes. Runs in a hidden window so it never interrupts your work. Results appear on your New Tab page.',
    badges: 'DAILY / HOURLY / MINUTES',
    grid: { column: '9 / span 4', row: '1' },
  },
  {
    tag: 'YOU', tagColor: '#7B6B8A', title: 'Suggest your feature',
    desc: 'What feature would you like to see in Craft Agents? Join our Discord and let us know.',
    badges: 'SUGGESTED FEATURES',
    light: true,
    grid: { column: '9 / span 4', row: '2' },
  },
  {
    tag: 'AGENT', tagColor: '#8A5A44', title: 'Agent Memory',
    desc: 'Your agent remembers context across sessions — preferences, past decisions, running notes. All stored locally as plain files you can read and edit. Memory that you own.',
    badges: 'PERSISTENT / LOCAL / EDITABLE',
    grid: { column: '1 / span 4', row: '3 / span 2' },
  },
  {
    tag: 'POWER', tagColor: '#5B7553', title: 'Filesystem Access',
    desc: 'Give the agent access to a local folder. Research the web and save reports. Read spreadsheets and fill forms. Run shell commands — all sandboxed to the folder you choose.',
    badges: 'READ / WRITE / RUN',
    highlight: 'SANDBOXED',
    grid: { column: '5 / span 5', row: '3 / span 2' },
  },
]

/* Constellation crosshairs that connect cards */
function ConstellationGrid() {
  const points = [
    [180, 40], [420, 30], [660, 50], [900, 35],
    [100, 180], [350, 200], [580, 170], [820, 190],
    [200, 320], [450, 340], [700, 310], [950, 330],
    [140, 460], [380, 480], [620, 450], [860, 470],
  ]
  const lines = [
    [0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[8,9],[9,10],[10,11],[12,13],[13,14],[14,15],
    [0,4],[1,5],[2,6],[3,7],[4,8],[5,9],[6,10],[7,11],[8,12],[9,13],[10,14],[11,15],
  ]
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.25 }} viewBox="0 0 1100 520" preserveAspectRatio="xMidYMid slice">
      {lines.map(([a, b], i) => (
        <line key={i} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]} stroke="#d0cdc7" strokeWidth="0.5" />
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <line x1={p[0]-4} y1={p[1]} x2={p[0]+4} y2={p[1]} stroke="#c5c2bc" strokeWidth="1" />
          <line x1={p[0]} y1={p[1]-4} x2={p[0]} y2={p[1]+4} stroke="#c5c2bc" strokeWidth="1" />
        </g>
      ))}
    </svg>
  )
}

export default function AgentFeatures() {
  return (
    <div className="relative">
      <ConstellationGrid />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'repeat(4, auto)',
          gap: 16,
        }}
      >
        {CARDS.map((card) => (
          <div
            key={card.title}
            className={`agent-card${card.light ? ' light' : ''}`}
            style={{
              gridColumn: card.grid.column,
              gridRow: card.grid.row,
            }}
          >
            <div className="agent-card-tag">
              <span className="agent-card-tag-dot" style={{ background: card.tagColor }} />
              <span>{card.tag}</span>
              {card.highlight && (
                <span className="card-badge" style={{ marginLeft: 'auto', fontSize: 9 }}>{card.highlight}</span>
              )}
            </div>
            <h3>{card.title}</h3>
            <p style={{ flex: 1 }}>{card.desc}</p>
            <div className="agent-card-badges">{card.badges}</div>
          </div>
        ))}
      </div>

      <div className="font-space" style={{ textAlign: 'right', marginTop: 24, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
        </svg>
        TRY MOVING AROUND THE CARDS
      </div>
    </div>
  )
}

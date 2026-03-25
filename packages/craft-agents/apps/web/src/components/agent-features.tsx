'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import './browseros-styles.css'

interface CardData {
  tag: string
  tagColor: string
  title: string
  desc: string
  badges: string
  bg: string
  x: number
  y: number
  w: number
  h: number
  rotate: number
  pin: boolean
  pinColor?: string
  highlight?: string
}

const INITIAL_CARDS: CardData[] = [
  {
    tag: 'AGENT', tagColor: '#5B7553', title: 'Skills',
    desc: 'Steer agent behavior with reusable instructions written in plain Markdown. Comes pre-installed with 12 skills — Deep Research, Form Fill, Data Extract, and more. Create your own or customize the built-ins.',
    badges: 'PRE-INSTALLED / CUSTOM / REUSABLE',
    bg: '#F5F0E0', x: 20, y: 60, w: 290, h: 390, rotate: -4, pin: false,
  },
  {
    tag: 'AGENT', tagColor: '#7B6B8A', title: 'SOUL.md',
    desc: "Define your agent's personality, values, and communication style in a single Markdown file. Every session starts by reading its soul — so it always knows who it is and how to behave.",
    badges: 'PERSONALITY / VALUES / STYLE',
    bg: '#FFFFFF', x: 320, y: -10, w: 280, h: 360, rotate: 1.5, pin: true, pinColor: '#C8885A',
  },
  {
    tag: 'AUTOMATION', tagColor: '#B5764A', title: 'Scheduled Tasks',
    desc: 'Set any task to run on autopilot. Daily, hourly, or every few minutes. Runs in a hidden window so it never interrupts your work. Results appear on your New Tab page.',
    badges: 'DAILY / HOURLY / MINUTES',
    bg: '#F0EDE4', x: 610, y: 50, w: 260, h: 310, rotate: -1.5, pin: false,
  },
  {
    tag: 'YOU', tagColor: '#7B6B8A', title: 'Suggest your feature',
    desc: 'What feature would you like to see in Craft Agents? Join our Discord and let us know.',
    badges: 'SUGGESTED FEATURES',
    bg: '#D8E4D0', x: 860, y: 20, w: 240, h: 290, rotate: 2.5, pin: false,
  },
  {
    tag: 'AGENT', tagColor: '#8A5A44', title: 'Agent Memory',
    desc: 'Your agent remembers context across sessions — preferences, past decisions, running notes. All stored locally as plain files you can read and edit. Memory that you own.',
    badges: 'PERSISTENT / LOCAL / EDITABLE',
    bg: '#F5F0E0', x: 80, y: 420, w: 310, h: 340, rotate: -2, pin: true, pinColor: '#D4A574',
  },
  {
    tag: 'POWER', tagColor: '#5B7553', title: 'Filesystem Access',
    desc: 'Give the agent access to a local folder. Research the web and save reports. Read spreadsheets and fill forms. Run shell commands — all sandboxed to the folder you choose.',
    badges: 'READ / WRITE / RUN',
    highlight: 'SANDBOXED',
    bg: '#FFFFFF', x: 400, y: 380, w: 310, h: 300, rotate: 0.5, pin: true, pinColor: '#7B9B8A',
  },
]

function Pin({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 16, height: 16, zIndex: 20 }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${color}, ${color}cc)`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)', margin: '0 auto',
      }} />
    </div>
  )
}

function CrosshairDots() {
  const points = [
    [48, 6], [53, 32], [26, 50], [72, 48], [38, 72], [62, 78],
    [15, 28], [85, 22], [50, 55], [30, 88], [70, 92], [90, 60],
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

function DraggableCard({ card, onDragStart, onDrag, onDragEnd, zIndex }: {
  card: CardData
  onDragStart: () => void
  onDrag: (dx: number, dy: number) => void
  onDragEnd: () => void
  zIndex: number
}) {
  const dragRef = useRef({ active: false, startX: 0, startY: 0 })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY }
    onDragStart()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [onDragStart])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    dragRef.current.startX = e.clientX
    dragRef.current.startY = e.clientY
    onDrag(dx, dy)
  }, [onDrag])

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false
    onDragEnd()
  }, [onDragEnd])

  return (
    <div
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.w,
        minHeight: card.h,
        backgroundColor: card.bg,
        transform: `rotate(${card.rotate}deg)`,
        padding: '28px 28px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'grab',
        zIndex,
        touchAction: 'none',
        userSelect: 'none',
        transition: dragRef.current.active ? 'box-shadow 0.2s' : 'box-shadow 0.3s, transform 0.3s',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
        fontSize: 14, lineHeight: 1.55, color: '#555', flex: 1, margin: 0,
      }}>
        {card.desc}
      </p>

      <div className="font-space" style={{
        fontSize: 9, letterSpacing: '0.05em',
        textTransform: 'uppercase' as const, color: '#999', marginTop: 'auto',
      }}>
        {card.badges}
      </div>
    </div>
  )
}

export default function AgentFeatures() {
  const [cards, setCards] = useState(INITIAL_CARDS)
  const [topZ, setTopZ] = useState(10)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const zMap = useRef<number[]>(INITIAL_CARDS.map((_, i) => i))

  const bringToFront = useCallback((idx: number) => {
    const newZ = topZ + 1
    setTopZ(newZ)
    zMap.current[idx] = newZ
  }, [topZ])

  return (
    <div style={{ position: 'relative', minHeight: 780, maxWidth: 1100, margin: '0 auto' }}>
      <CrosshairDots />

      {cards.map((card, idx) => (
        <DraggableCard
          key={card.title}
          card={card}
          zIndex={zMap.current[idx]}
          onDragStart={() => {
            setActiveIdx(idx)
            bringToFront(idx)
          }}
          onDrag={(dx, dy) => {
            setCards(prev => prev.map((c, i) =>
              i === idx ? { ...c, x: c.x + dx, y: c.y + dy } : c
            ))
          }}
          onDragEnd={() => setActiveIdx(null)}
        />
      ))}

      <div className="font-space" style={{
        position: 'absolute', bottom: 0, right: 0,
        fontSize: 11, letterSpacing: '0.1em',
        textTransform: 'uppercase' as const, color: '#aaa',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(244,241,230,0.8)', padding: '8px 16px',
        borderRadius: 6,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
          <path d="M5 9l4-4 4 4M5 15l4 4 4-4M15 9l4-4M15 15l4 4" />
        </svg>
        TRY MOVING AROUND THE CARDS
      </div>
    </div>
  )
}

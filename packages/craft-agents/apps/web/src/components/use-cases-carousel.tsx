'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import './browseros-styles.css'

interface UseCase {
  bg: string
  rotate: string
  tag: string
  title: string
  desc: string
  icon: string
}

const ICON_PATHS: Record<string, string> = {
  shop: 'M3 3h18l-2 13H5L3 3zm0 0l-1-2M7 16v5m10-5v5M2 21h20M9 8h6',
  research: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6',
  marketing: 'M16 8v8m-4-5v5m-4-2v2M4 4h16v16H4z',
  growth: 'M13 7l5 5-5 5M6 12h12M2 20V4',
  testing: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
}

export default function UseCasesCarousel({ cases }: { cases: UseCase[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragX, setDragX] = useState(0)
  const dragState = useRef({ active: false, startX: 0, startDrag: 0 })

  const onDown = useCallback((e: React.PointerEvent) => {
    dragState.current = { active: true, startX: e.clientX, startDrag: dragX }
    ;(e.currentTarget as HTMLElement).style.cursor = 'grabbing'
  }, [dragX])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active) return
    const dx = e.clientX - dragState.current.startX
    setDragX(dragState.current.startDrag + dx)
  }, [])

  const onUp = useCallback((e: React.PointerEvent) => {
    dragState.current.active = false
    ;(e.currentTarget as HTMLElement).style.cursor = 'grab'
  }, [])

  // Card dimensions
  const cardW = 300
  const gap = 20
  const totalW = cases.length * (cardW + gap)

  return (
    <div>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          cursor: 'grab',
          touchAction: 'pan-y',
          userSelect: 'none',
          padding: '40px 0',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <div
          ref={trackRef}
          style={{
            display: 'flex',
            gap: gap,
            transform: `translateX(${dragX}px)`,
            transition: dragState.current.active ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
            paddingLeft: 40,
            paddingRight: 40,
          }}
        >
          {cases.map((c, i) => (
            <div
              key={c.title}
              style={{
                flexShrink: 0,
                width: cardW,
                height: 440,
                perspective: 800,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,0.1)',
                  backgroundColor: c.bg,
                  color: '#0E0E0E',
                  transform: `rotate(${c.rotate}) rotateY(${i % 2 === 0 ? -3 : 3}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.5s',
                }}
              >
                {/* Big background icon */}
                <svg
                  aria-hidden="true"
                  style={{
                    position: 'absolute', bottom: -20, right: -20,
                    opacity: 0.08, transform: 'rotate(-15deg)',
                    width: '16rem', height: '16rem',
                  }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.5"
                >
                  <path d={ICON_PATHS[c.icon] || ICON_PATHS.shop} />
                </svg>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'inline-block' }} />
                    <span className="font-space" style={{
                      fontSize: 10, letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const, opacity: 0.7,
                    }}>
                      {c.tag}
                    </span>
                  </div>
                  <h3 className="font-space" style={{
                    fontWeight: 700,
                    fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
                    lineHeight: 0.95,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '-0.02em',
                    margin: 0,
                    color: '#0E0E0E',
                  }}>
                    {c.title}
                  </h3>
                </div>

                <p className="font-heading" style={{
                  position: 'relative', zIndex: 1,
                  fontSize: '1.15rem', lineHeight: 1.4, opacity: 0.9, margin: 0,
                }}>
                  {c.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="font-space" style={{
        textAlign: 'center', fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        color: '#666',
      }}>
        &larr; DRAG TO EXPLORE &rarr;
      </div>
    </div>
  )
}

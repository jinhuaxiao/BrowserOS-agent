'use client'

import { useRef, useState, useCallback } from 'react'
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

// Each card has a unique position offset and rotation — like browseros.com's fan spread
const CARD_TRANSFORMS = [
  { x: -520, y: 20, z: -30, rotY: 8, rotCard: '-2.5deg' },
  { x: -260, y: -10, z: -10, rotY: 4, rotCard: '1.8deg' },
  { x: 0, y: 0, z: 0, rotY: 0, rotCard: '-1.2deg' },
  { x: 260, y: -10, z: -10, rotY: -4, rotCard: '3.2deg' },
  { x: 520, y: 20, z: -30, rotY: -8, rotCard: '1.5deg' },
]

export default function UseCasesCarousel({ cases }: { cases: UseCase[] }) {
  const [dragOffset, setDragOffset] = useState(0)
  const dragState = useRef({ active: false, startX: 0, startOffset: 0 })

  const onDown = useCallback((e: React.PointerEvent) => {
    dragState.current = { active: true, startX: e.clientX, startOffset: dragOffset }
  }, [dragOffset])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active) return
    setDragOffset(dragState.current.startOffset + (e.clientX - dragState.current.startX))
  }, [])

  const onUp = useCallback(() => {
    dragState.current.active = false
  }, [])

  return (
    <div>
      <section
        style={{
          position: 'relative',
          height: 'clamp(420px, 55vw, 560px)',
          perspective: 1200,
          cursor: 'grab',
          overflow: 'visible',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {cases.map((c, i) => {
          const t = CARD_TRANSFORMS[i] || CARD_TRANSFORMS[2]
          const x = t.x + dragOffset
          const transition = dragState.current.active ? 'none' : 'transform 0.6s cubic-bezier(0.215, 0.61, 0.355, 1)'

          return (
            <div
              key={c.title}
              style={{
                position: 'absolute',
                width: 'clamp(260px, 24vw, 320px)',
                height: 'clamp(360px, 34vw, 440px)',
                transformStyle: 'preserve-3d',
                willChange: 'transform',
                transform: `translateX(${x}px) translateY(${t.y}px) translateZ(${t.z}px) rotateY(${t.rotY}deg)`,
                transition,
                zIndex: 10 - Math.abs(i - 2),
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
                  transform: `rotate(${c.rotate})`,
                }}
              >
                {/* Large background icon */}
                <svg
                  aria-hidden="true"
                  style={{
                    position: 'absolute', bottom: -20, right: -20,
                    opacity: 0.1, transform: 'rotate(-15deg)',
                    width: '16rem', height: '16rem',
                  }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.5"
                >
                  <path d={ICON_PATHS[c.icon] || ICON_PATHS.shop} />
                </svg>

                {/* Tag */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.2)', display: 'inline-block' }} />
                    <span className="font-space" style={{
                      fontSize: 10, letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const, opacity: 0.6,
                    }}>
                      {c.tag}
                    </span>
                  </div>
                  <h3 className="font-space" style={{
                    fontWeight: 700,
                    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                    lineHeight: 0.95,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '-0.02em',
                    margin: 0,
                    color: '#0E0E0E',
                  }}>
                    {c.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="font-heading" style={{
                  position: 'relative', zIndex: 1,
                  fontSize: '1.15rem', lineHeight: 1.4, opacity: 0.9, margin: 0,
                }}>
                  {c.desc}
                </p>
              </div>
            </div>
          )
        })}
      </section>

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

'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
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

function getSpacing() {
  if (typeof window === 'undefined') return 380
  return window.innerWidth < 768 ? 240 : 380
}

export default function UseCasesCarousel({ cases }: { cases: UseCase[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number>(0)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const targetOffset = useRef(0)
  const smoothOffset = useRef(0)
  const velocity = useRef(0)
  const screenW = useRef(typeof window !== 'undefined' ? window.innerWidth : 1024)

  const animate = useCallback(() => {
    // Physics: inertia when not dragging
    if (!isDragging.current) {
      targetOffset.current += velocity.current
      velocity.current *= 0.95
      if (Math.abs(velocity.current) < 0.1) {
        // Gentle auto-scroll
        targetOffset.current += 0.29
      }
    }

    // Smooth follow
    smoothOffset.current += (targetOffset.current - smoothOffset.current) * 0.115

    const w = screenW.current
    const isMobile = w < 768
    const depth = isMobile ? 200 : 400
    const rotAngle = isMobile ? 20 : 35
    const spacing = getSpacing()

    for (let k = 0; k < cardRefs.current.length; k++) {
      const el = cardRefs.current[k]
      if (!el) continue

      // Wrap-around positioning
      let pos = k * spacing - smoothOffset.current
      const totalW = cases.length * spacing
      while (pos < -totalW / 2) pos += totalW
      while (pos > totalW / 2) pos -= totalW

      if (Math.abs(pos) < w * 0.8) {
        el.style.display = 'block'
        const M = pos / (w / 2.5)
        const tx = pos
        const tz = -(Math.abs(M) ** 1.8) * depth
        const ry = M * rotAngle
        el.style.transform = `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg)`
        el.style.opacity = String(1 - Math.abs(M) ** 4)
        el.style.zIndex = String(Math.round(100 - Math.abs(M) * 100))
      } else {
        el.style.display = 'none'
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [cases.length])

  // Initialize animation loop
  useEffect(() => {
    function onResize() { screenW.current = window.innerWidth }
    window.addEventListener('resize', onResize)
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [animate])

  // Mouse drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    lastX.current = e.clientX
    velocity.current = 0
  }, [])

  useEffect(() => {
    function onMouseUp() { isDragging.current = false }
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      targetOffset.current -= dx * 1.2
      velocity.current = -dx * 0.4
    }
    function onTouchStart(e: TouchEvent) {
      isDragging.current = true
      lastX.current = e.touches[0].clientX
      velocity.current = 0
    }
    function onTouchEnd() { isDragging.current = false }
    function onTouchMove(e: TouchEvent) {
      if (!isDragging.current) return
      const x = e.touches[0].clientX
      const dx = x - lastX.current
      lastX.current = x
      targetOffset.current -= dx * 1.2
      velocity.current = -dx * 0.4
    }

    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return (
    <div>
      <section
        ref={containerRef}
        aria-label="Use cases carousel"
        style={{
          position: 'relative',
          height: 'clamp(380px, 50vw, 520px)',
          perspective: 1200,
          cursor: isDragging.current ? 'grabbing' : 'grab',
          overflow: 'visible',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onMouseDown={onMouseDown}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
          {cases.map((c, i) => (
            <div
              key={c.title}
              ref={(el) => { cardRefs.current[i] = el }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 'clamp(260px, 70vw, 320px)',
                height: 'clamp(360px, 50vw, 440px)',
                marginLeft: 'clamp(-160px, -35vw, -130px)',
                marginTop: 'clamp(-220px, -25vw, -180px)',
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
                display: 'block',
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
                {/* Background icon */}
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

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.2)', display: 'inline-block' }} />
                    <span className="font-space" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, opacity: 0.6 }}>
                      {c.tag}
                    </span>
                  </div>
                  <h3 className="font-space" style={{
                    fontWeight: 700,
                    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                    lineHeight: 0.95,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '-0.02em',
                    margin: 0, color: '#0E0E0E',
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
      </section>

      <div className="font-space" style={{
        textAlign: 'center', fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#888' }}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <span className="hidden sm:inline">DRAG TO EXPLORE</span>
        <span className="sm:hidden">SWIPE TO EXPLORE</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#888' }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </div>
    </div>
  )
}

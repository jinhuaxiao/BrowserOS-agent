'use client'

import { useRef } from 'react'

interface UseCase {
  bg: string
  dotColor: string
  tag: string
  title: string
  desc: string
}

export default function UseCasesCarousel({ cases }: { cases: UseCase[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-6 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`[data-carousel]::-webkit-scrollbar { display: none; }`}</style>
        {cases.map((c) => (
          <div
            key={c.title}
            className="flex-shrink-0 snap-start flex flex-col justify-between relative overflow-hidden"
            style={{
              width: 'clamp(260px, 70vw, 320px)',
              height: 'clamp(360px, 50vw, 440px)',
              backgroundColor: c.bg,
              color: '#fff',
              padding: '1.5rem',
            }}
          >
            {/* Background icon outline */}
            <svg
              viewBox="0 0 100 100"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10"
              style={{ width: '70%', height: '70%' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="15" y="10" width="70" height="50" rx="3" />
              <line x1="30" y1="70" x2="70" y2="70" />
              <circle cx="50" cy="80" r="5" />
            </svg>

            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: c.dotColor }} />
                <span
                  className="text-[10px] tracking-[0.1em] uppercase opacity-80"
                  style={{ fontFamily: 'var(--font-mono-display)' }}
                >
                  {c.tag}
                </span>
              </div>
              <h3
                className="font-bold uppercase tracking-[-0.02em] leading-[0.95] m-0 mb-4"
                style={{
                  fontFamily: "'Space Mono', 'Inter', sans-serif",
                  fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                }}
              >
                {c.title}
              </h3>
            </div>

            <p
              className="relative z-10 text-base leading-snug opacity-90 mt-auto"
              style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', lineHeight: '1.4' }}
            >
              {c.desc}
            </p>
          </div>
        ))}
      </div>

      <div
        className="text-center mt-4 text-xs tracking-[0.1em] uppercase"
        style={{ fontFamily: 'var(--font-mono-display)', color: '#666' }}
      >
        &larr; DRAG TO EXPLORE &rarr;
      </div>
    </div>
  )
}

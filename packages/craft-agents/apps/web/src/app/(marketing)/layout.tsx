import Link from 'next/link'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Editorial Header */}
      <header className="w-full max-w-[1400px] mx-auto flex justify-between items-center text-sm py-5 px-6 md:px-16 mb-4 md:mb-8">
        <Link
          href="/"
          className="text-[var(--ink)] font-semibold tracking-tight text-base no-underline"
        >
          Craft Agents
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors text-sm no-underline"
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors text-sm no-underline"
          >
            Docs
          </Link>
          <Link
            href="/download"
            className="text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors text-sm no-underline"
          >
            Download
          </Link>
          <div
            className="flex items-center gap-1.5 text-xs text-[var(--ink-light)]"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-green-500"
              style={{ boxShadow: '0 0 4px rgba(34,197,94,0.5)' }}
            />
            <span>open source</span>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col items-center">
        {children}
      </main>

      {/* Footer — browseros style */}
      <footer className="w-full border-t border-[var(--color-divider)]" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-[1200px] mx-auto px-6 md:px-16 py-16">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
            {/* Left: Brand + mission */}
            <div className="flex-1 max-w-md">
              <div className="font-semibold text-base mb-3" style={{ color: 'var(--ink)' }}>
                Craft Agents
              </div>
              <p className="font-heading text-lg italic mb-4" style={{ color: 'var(--ink)' }}>
                Your Browser. <em>Your rules.</em>
              </p>
              <p className="text-sm leading-relaxed" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: '#666' }}>
                We believe browsers should be open source and privacy-first — not tracking software for search or ad companies.
                The future is agents that automate your work locally and securely. We are building the best browser for that future.
              </p>
            </div>

            {/* Right: Link columns + CTA */}
            <div className="flex gap-16 items-start">
              <div>
                <h4 className="font-space text-xs tracking-[0.12em] uppercase mb-4" style={{ color: 'var(--ink)' }}>Product</h4>
                <div className="flex flex-col gap-2">
                  <Link href="/#features" className="text-sm no-underline transition-colors" style={{ color: '#666' }}>Features</Link>
                  <Link href="/#use-cases" className="text-sm no-underline transition-colors" style={{ color: '#666' }}>Use Cases</Link>
                  <Link href="/docs" className="text-sm no-underline transition-colors" style={{ color: '#666' }}>Docs</Link>
                </div>
              </div>
              <div>
                <h4 className="font-space text-xs tracking-[0.12em] uppercase mb-4" style={{ color: 'var(--ink)' }}>Legal</h4>
                <div className="flex flex-col gap-2">
                  <span className="text-sm" style={{ color: '#999' }}>Privacy Policy</span>
                  <span className="text-sm" style={{ color: '#999' }}>Terms & Conditions</span>
                </div>
              </div>
              <div>
                <h4 className="font-space text-xs tracking-[0.12em] uppercase mb-4" style={{ color: 'var(--ink)' }}>Community</h4>
                <div className="flex flex-col gap-2">
                  <a href="https://github.com/nicepkg/craft-agents" target="_blank" rel="noopener noreferrer" className="text-sm no-underline transition-colors" style={{ color: '#666' }}>GitHub</a>
                  <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" className="text-sm no-underline transition-colors" style={{ color: '#666' }}>Discord</a>
                  <a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="text-sm no-underline transition-colors" style={{ color: '#666' }}>X</a>
                </div>
              </div>

              <Link
                href="/download"
                className="no-underline font-space text-sm"
                style={{
                  border: '1px solid var(--ink)',
                  borderRadius: 999,
                  padding: '10px 24px',
                  color: 'var(--color-bg)',
                  backgroundColor: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.2s',
                }}
              >
                Download Craft Agents
              </Link>
            </div>
          </div>

          {/* Copyright */}
          <div className="font-space text-xs mt-12 pt-6 border-t border-[var(--color-divider)]" style={{ color: '#999' }}>
            &copy; {new Date().getFullYear()} Craft Agents. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

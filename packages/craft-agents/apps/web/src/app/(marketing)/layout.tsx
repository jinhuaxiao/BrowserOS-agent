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

      {/* Editorial Footer */}
      <footer className="w-full max-w-[1400px] mx-auto flex justify-between text-xs text-[var(--ink-light)] mt-8 pt-4 px-6 md:px-16">
        <span>&copy; {new Date().getFullYear()} Craft Agents</span>
        <div className="flex gap-4">
          <a
            href="https://github.com/nicepkg/craft-agents"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-light)] hover:text-[var(--ink)] no-underline transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://discord.gg/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-light)] hover:text-[var(--ink)] no-underline transition-colors"
          >
            Discord
          </a>
        </div>
      </footer>
    </div>
  )
}

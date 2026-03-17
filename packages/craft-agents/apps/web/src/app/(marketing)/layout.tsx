import Link from 'next/link'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-divider">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-foreground tracking-tight"
          >
            Craft Agents
          </Link>
          <div className="flex items-center gap-8">
            <Link
              href="/pricing"
              className="text-sm text-text-muted hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/docs"
              className="text-sm text-text-muted hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/download"
              className="text-sm text-text-muted hover:text-foreground transition-colors"
            >
              Download
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="text-sm text-text-muted hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="px-5 py-2 text-sm font-medium rounded-full bg-primary text-text-inverse hover:bg-primary-hover transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-divider py-12 bg-surface-2">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold text-foreground mb-4 text-sm tracking-wide uppercase">
                Product
              </h3>
              <div className="flex flex-col gap-2">
                <Link
                  href="/download"
                  className="text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  Download
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/docs"
                  className="text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  Documentation
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4 text-sm tracking-wide uppercase">
                Company
              </h3>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-faint">About</span>
                <span className="text-sm text-text-faint">Blog</span>
                <span className="text-sm text-text-faint">Careers</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4 text-sm tracking-wide uppercase">
                Legal
              </h3>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-faint">Privacy</span>
                <span className="text-sm text-text-faint">Terms</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4 text-sm tracking-wide uppercase">
                Support
              </h3>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-faint">Help Center</span>
                <span className="text-sm text-text-faint">Contact</span>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-divider text-sm text-text-faint">
            &copy; {new Date().getFullYear()} Craft Agents. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

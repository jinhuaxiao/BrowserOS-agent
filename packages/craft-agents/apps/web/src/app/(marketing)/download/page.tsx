import { Apple, Laptop, Monitor } from 'lucide-react'

const platforms = [
  {
    icon: Apple,
    name: 'macOS',
    description: 'Apple Silicon & Intel',
    downloads: [
      {
        label: 'Apple Silicon (M1+)',
        href: '#',
        filename: 'CraftAgents-arm64.dmg',
      },
      { label: 'Intel', href: '#', filename: 'CraftAgents-x64.dmg' },
    ],
  },
  {
    icon: Monitor,
    name: 'Windows',
    description: 'Windows 10+',
    downloads: [
      { label: 'Windows x64', href: '#', filename: 'CraftAgents-x64.exe' },
    ],
  },
  {
    icon: Laptop,
    name: 'Linux',
    description: 'Ubuntu 20.04+',
    downloads: [
      { label: 'AppImage', href: '#', filename: 'CraftAgents.AppImage' },
      { label: '.deb', href: '#', filename: 'CraftAgents.deb' },
    ],
  },
]

export default function DownloadPage() {
  return (
    <div className="py-24 px-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Download Craft Agents
          </h1>
          <p className="text-lg text-text-muted">
            Available for macOS, Windows, and Linux. Free to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {platforms.map((platform) => (
            <div
              key={platform.name}
              className="p-8 rounded-xl border border-divider bg-surface shadow-sm text-center"
            >
              <platform.icon className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-1">
                {platform.name}
              </h2>
              <p className="text-sm text-text-muted mb-6">
                {platform.description}
              </p>
              <div className="flex flex-col gap-3">
                {platform.downloads.map((dl) => (
                  <a
                    key={dl.label}
                    href={dl.href}
                    className="block py-2.5 rounded-full text-sm font-medium border border-divider text-foreground hover:bg-surface-offset transition-colors"
                  >
                    {dl.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-text-faint">
            Current version: 0.2.34 &middot; Release notes
          </p>
        </div>
      </div>
    </div>
  )
}

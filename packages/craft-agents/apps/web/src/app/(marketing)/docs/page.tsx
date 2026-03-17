import { Book, Download, Settings, Shield, Users, Zap } from 'lucide-react'
import Link from 'next/link'

const sections = [
  {
    icon: Download,
    title: 'Getting Started',
    description: 'Install Craft Agents and create your first browser profile.',
    href: '#getting-started',
  },
  {
    icon: Shield,
    title: 'Fingerprint Configuration',
    description:
      'Learn how to configure browser fingerprints for maximum stealth.',
    href: '#fingerprint',
  },
  {
    icon: Settings,
    title: 'Proxy Setup',
    description: 'Configure proxies for your browser profiles.',
    href: '#proxy',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Set up teams, roles, and share profiles with members.',
    href: '#team',
  },
  {
    icon: Zap,
    title: 'AI Automation',
    description: 'Use the built-in AI agent to automate browser tasks.',
    href: '#automation',
  },
  {
    icon: Book,
    title: 'API Reference',
    description: 'REST API documentation for integrating with your workflows.',
    href: '#api',
  },
]

export default function DocsPage() {
  return (
    <div className="py-24 px-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Documentation
          </h1>
          <p className="text-lg text-text-muted">
            Everything you need to know about Craft Agents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="p-6 rounded-xl border border-divider bg-surface shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <section.icon className="w-8 h-8 text-primary mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                {section.title}
              </h2>
              <p className="text-sm text-text-muted">{section.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-xl border border-divider bg-surface text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Full documentation coming soon
          </h2>
          <p className="text-sm text-text-muted">
            We&apos;re working on comprehensive docs. In the meantime, check out
            the app&apos;s built-in help.
          </p>
        </div>
      </div>
    </div>
  )
}

import { Fingerprint, Globe, Lock, Shield, Users, Zap } from 'lucide-react'
import Link from 'next/link'

const features = [
  {
    icon: Fingerprint,
    title: 'Unique Fingerprints',
    description:
      'Each browser profile has a unique, consistent fingerprint that passes all detection tests.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description:
      'Share profiles with your team. Role-based access control keeps everything secure.',
  },
  {
    icon: Globe,
    title: 'Proxy Management',
    description:
      'Built-in proxy pool management with geo-targeting. Assign proxies to profiles automatically.',
  },
  {
    icon: Shield,
    title: 'Anti-Detection',
    description:
      'Chromium-level fingerprint protection. Canvas, WebGL, audio, fonts — all covered.',
  },
  {
    icon: Zap,
    title: 'AI Automation',
    description:
      'Built-in AI agent powered by Claude. Automate repetitive browser tasks with natural language.',
  },
  {
    icon: Lock,
    title: 'Encrypted Storage',
    description:
      'All sensitive data is encrypted at rest. Cookies and credentials are stored securely.',
  },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    profiles: '10 profiles',
    members: '1 member',
    features: ['Basic fingerprinting', 'Local storage', 'Community support'],
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    profiles: '100 profiles',
    members: '1 member',
    features: [
      'Advanced fingerprinting',
      'Cloud sync',
      'Priority support',
      'Cookie import/export',
    ],
    popular: true,
  },
  {
    name: 'Team',
    price: '$79',
    period: '/month',
    profiles: '500 profiles',
    members: '10 members',
    features: [
      'Everything in Pro',
      'Team management',
      'Role-based access',
      'Activity logs',
      'Profile sharing',
    ],
  },
]

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">
            The Anti-Detect Browser
            <br />
            <span className="text-primary">Built for Teams</span>
          </h1>
          <p className="text-lg text-text-muted mb-10 max-w-2xl mx-auto">
            Manage hundreds of browser profiles with unique fingerprints.
            Collaborate with your team, automate with AI, and stay undetected.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/download"
              className="px-8 py-3 text-base font-medium rounded-full bg-primary text-text-inverse hover:bg-primary-hover transition-colors"
            >
              Download for Free
            </Link>
            <Link
              href="/docs"
              className="px-8 py-3 text-base font-medium rounded-full border border-divider text-foreground hover:bg-surface-offset transition-colors"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-surface-2">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-16">
            Everything you need for multi-account management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-divider bg-surface shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-text-muted mb-16">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-xl border shadow-sm ${
                  plan.popular
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-divider'
                } bg-surface relative`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-text-inverse text-xs font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-text-muted">{plan.period}</span>
                </div>
                <div className="text-sm text-text-muted mb-1">
                  {plan.profiles}
                </div>
                <div className="text-sm text-text-muted mb-6">
                  {plan.members}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="text-sm text-text-muted flex items-start gap-2"
                    >
                      <span className="text-success mt-0.5">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === 'Free' ? '/download' : '/sign-up'}
                  className={`block text-center py-2.5 rounded-full text-sm font-medium transition-colors ${
                    plan.popular
                      ? 'bg-primary text-text-inverse hover:bg-primary-hover'
                      : 'border border-divider text-foreground hover:bg-surface-offset'
                  }`}
                >
                  {plan.name === 'Free' ? 'Download Free' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-surface-2">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to get started?
          </h2>
          <p className="text-text-muted mb-8">
            Download Craft Agents and create your first browser profile in
            minutes.
          </p>
          <Link
            href="/download"
            className="inline-block px-8 py-3 text-base font-medium rounded-full bg-primary text-text-inverse hover:bg-primary-hover transition-colors"
          >
            Download Now
          </Link>
        </div>
      </section>
    </>
  )
}

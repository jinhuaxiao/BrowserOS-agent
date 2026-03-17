import { Check } from 'lucide-react'
import Link from 'next/link'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description:
      'For individuals getting started with multi-account management.',
    limits: { profiles: 10, members: 1, storage: '1 GB' },
    features: [
      'Basic fingerprinting',
      'Local storage only',
      'Manual proxy configuration',
      'Community support',
    ],
    cta: 'Download Free',
    href: '/download',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For power users who need cloud sync and advanced features.',
    limits: { profiles: 100, members: 1, storage: '10 GB' },
    features: [
      'Advanced fingerprinting',
      'Cloud sync across devices',
      'Cookie import/export',
      'Priority email support',
      'API access',
      'Automated proxy rotation',
    ],
    cta: 'Start Free Trial',
    href: '/sign-up',
    popular: true,
  },
  {
    name: 'Team',
    price: '$79',
    period: '/month',
    description: 'For teams that need collaboration and access control.',
    limits: { profiles: 500, members: 10, storage: '50 GB' },
    features: [
      'Everything in Pro',
      'Team management',
      'Role-based access control',
      'Profile sharing & assignments',
      'Activity audit logs',
      'Group management',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    href: '/sign-up',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description:
      'For organizations with advanced security and compliance needs.',
    limits: {
      profiles: 'Unlimited',
      members: 'Unlimited',
      storage: 'Unlimited',
    },
    features: [
      'Everything in Team',
      'SSO / SAML',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
      'On-premise deployment option',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@craftagents.com',
  },
]

export default function PricingPage() {
  return (
    <div className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Pricing
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Start free, scale as you grow. All plans include core anti-detection
            features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col p-8 rounded-xl border shadow-sm ${
                tier.popular
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-divider'
              } bg-surface`}
            >
              {tier.popular && (
                <div className="text-xs font-medium text-primary mb-4">
                  MOST POPULAR
                </div>
              )}
              <h2 className="text-xl font-semibold text-foreground">
                {tier.name}
              </h2>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-text-muted">{tier.period}</span>
                )}
              </div>
              <p className="mt-4 text-sm text-text-muted">{tier.description}</p>

              <div className="mt-6 space-y-2 text-sm">
                <div className="text-text-muted">
                  {typeof tier.limits.profiles === 'number'
                    ? `${tier.limits.profiles} profiles`
                    : tier.limits.profiles}
                </div>
                <div className="text-text-muted">
                  {typeof tier.limits.members === 'number'
                    ? `${tier.limits.members} ${tier.limits.members === 1 ? 'member' : 'members'}`
                    : `${tier.limits.members} members`}
                </div>
                <div className="text-text-muted">
                  {tier.limits.storage} storage
                </div>
              </div>

              <ul className="mt-8 space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-text-muted"
                  >
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.href}
                className={`mt-8 block text-center py-2.5 rounded-full text-sm font-medium transition-colors ${
                  tier.popular
                    ? 'bg-primary text-text-inverse hover:bg-primary-hover'
                    : 'border border-divider text-foreground hover:bg-surface-offset'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import RetroComputer from '@/components/retro-computer/RetroComputer'
import CopyButton from '@/components/copy-button'
import FeatureCards from '@/components/feature-cards'
import UseCasesCarousel from '@/components/use-cases-carousel'
import AgentFeatures from '@/components/agent-features'
import FaqSection from '@/components/faq-section'

const USE_CASES = [
  {
    bg: '#F0E8D8', rotate: '-2.5deg', tag: 'E-COMMERCE', icon: 'shop',
    title: 'Shop Managers',
    desc: 'Run multiple storefronts across Amazon, Shopify, and eBay. Each store gets its own browser profile with unique fingerprint and geo-matched proxy.',
  },
  {
    bg: '#C8885A', rotate: '1.8deg', tag: 'SCHEDULED SCRAPING', icon: 'research',
    title: 'Researchers',
    desc: 'Scrape competitor pricing every morning, track changes over time, and organize findings in Google Sheets automatically.',
  },
  {
    bg: '#A896AB', rotate: '-1.2deg', tag: 'CONTENT + SOCIAL', icon: 'marketing',
    title: 'Marketers',
    desc: 'Manage multiple social media accounts without cross-contamination. Schedule posts, track engagement, and run ad campaigns across isolated profiles.',
  },
  {
    bg: '#C1847B', rotate: '3.2deg', tag: 'AUTOMATION', icon: 'growth',
    title: 'Growth Hackers',
    desc: 'Automate account creation, outreach sequences, and data collection across platforms. Each workflow runs in its own isolated browser profile.',
  },
  {
    bg: '#7A9478', rotate: '1.5deg', tag: 'TESTING', icon: 'testing',
    title: 'QA Engineers',
    desc: 'Test web apps across different browser fingerprints, geolocations, and device profiles. Catch bugs that only appear in specific environments.',
  },
]

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="font-space" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <span style={{ fontSize: 12, color: '#888' }}>[ {num} ]</span>
      <span style={{ width: 32, height: 1, background: '#ccc', display: 'inline-block' }} />
      <span style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888' }}>{label}</span>
    </div>
  )
}

export default function LandingPage() {
  const installCmd = 'brew install craft-agents'

  return (
    <>
      {/* ══ Hero — Editorial Card ══ */}
      <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', background: 'white', border: '1px solid var(--ink)', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div style={{ padding: '64px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--ink)' }}>
          <h1 className="font-heading" style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)', fontWeight: 400, fontStyle: 'italic', lineHeight: 0.95, letterSpacing: '-0.03em', marginBottom: 40, maxWidth: '90%' }}>
            The Anti-Detect Browser,{' '}<em>Reimagined</em>
          </h1>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span className="mono-label" style={{ fontSize: 11, color: '#888' }}>Get Started</span>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, maxWidth: 400 }}>
              Manage hundreds of browser profiles with unique fingerprints.
              Collaborate with your team, automate with AI, and stay undetected.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code className="font-space" style={{ flex: 1, minWidth: 0, fontSize: 12, background: 'var(--color-surface-offset)', padding: '8px 12px', border: '1px solid var(--ink)', userSelect: 'all', cursor: 'text' }}>
                {installCmd}
              </code>
              <CopyButton text={installCmd} />
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 4 }}>
              {[
                { href: '/download', label: 'Download' },
                { href: 'https://github.com/nicepkg/craft-agents', label: 'GitHub', external: true },
                { href: '/docs', label: 'Docs' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  style={{ color: 'var(--ink)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--ink)', paddingBottom: 2, fontSize: 14, transition: 'opacity 0.2s' }}
                >
                  {link.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                </a>
              ))}
            </div>
          </div>
        </div>
        <RetroComputer />
      </div>

      {/* ══ Section 01: Features ══ */}
      <section id="features" className="section-divider" style={{ width: '100%', paddingTop: 64, paddingBottom: 64 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <SectionLabel num="01" label="Features" />
          <h2 className="font-heading" style={{ fontWeight: 300, lineHeight: 1, letterSpacing: '-0.03em', fontSize: 'clamp(2.5rem, 8vw, 6rem)', marginBottom: 8 }}>
            Manage.<br />
            <span style={{ color: '#7B6B8A', fontStyle: 'italic' }}>Automate.</span><br />
            Scale.
          </h2>
          <p className="font-space" style={{ fontSize: 13, lineHeight: 1.6, color: '#666', maxWidth: 400, marginBottom: 48 }}>
            Your browser, supercharged with fingerprints and AI agents.
            From one profile to thousands — without getting detected.
          </p>

          <FeatureCards />
        </div>
      </section>

      {/* ══ Section 02: Use Cases (dark) ══ */}
      <section id="use-cases" className="section-divider" style={{ width: '100%', background: 'var(--color-ink-black, #0f0f0f)', padding: '56px 0 96px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div className="font-space" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 12, color: '#666' }}>[ 02 ]</span>
            <span style={{ width: 32, height: 1, background: '#444', display: 'inline-block' }} />
            <span style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#666' }}>Use Cases</span>
          </div>
          <h2 className="font-heading" style={{ fontWeight: 300, lineHeight: 0.95, letterSpacing: '-2px', fontSize: 'clamp(2rem, 6vw, 3rem)', color: '#fff', marginBottom: 16 }}>
            Built for<span style={{ display: 'block', fontStyle: 'italic' }}> every role.</span>
          </h2>
          <p className="font-space" style={{ fontSize: 13, color: '#666', marginBottom: 40 }}>
            From e-commerce sellers to growth hackers — real workflows powered by Craft Agents.
          </p>

          <UseCasesCarousel cases={USE_CASES} />
        </div>
      </section>

      {/* ══ Section 03: Agent Features ══ */}
      <section id="agent-features" className="section-divider" style={{ width: '100%', padding: '64px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <SectionLabel num="03" label="Agent Features" />
          <h2 className="font-heading" style={{ fontWeight: 300, lineHeight: 0.95, letterSpacing: '-2px', fontSize: 'clamp(2rem, 6vw, 3rem)', marginBottom: 16 }}>
            A smarter agent<span style={{ fontStyle: 'italic' }}> built into your browser.</span>
          </h2>
          <p className="font-space" style={{ fontSize: 13, color: '#666', marginBottom: 48 }}>
            Memory, personality, and automation — all running locally.
          </p>

          <AgentFeatures />
        </div>
      </section>

      {/* ══ Section 04: FAQ ══ */}
      <FaqSection />
    </>
  )
}

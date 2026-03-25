import Link from 'next/link'
import RetroComputer from '@/components/retro-computer/RetroComputer'
import CopyButton from '@/components/copy-button'
import UseCasesCarousel from '@/components/use-cases-carousel'

/* ── Section 01: Feature Cards ── */
const FEATURE_CARDS = [
  {
    id: 'fingerprints',
    span: 'col-span-8',
    row: 'row-span-2',
    color: '#5B7553',
    num: '01',
    tag: 'STEALTH',
    title: 'Unique Fingerprints for Every Profile',
    desc: 'Each browser profile runs with a distinct, hardware-level fingerprint — Canvas, WebGL, audio, fonts, and 50+ signals. All generated at Chromium level. Passes every detection test. No extensions, no patches.',
    badges: ['CHROMIUM-LEVEL', 'UNDETECTABLE'],
  },
  {
    id: 'ai-agent',
    span: 'col-span-4',
    row: 'row-span-2',
    color: '#7B6B8A',
    num: '02',
    tag: 'AI AGENT',
    title: 'Automate with Natural Language',
    desc: 'Built-in AI agent powered by Claude, Gemini, or any LLM. Describe tasks in plain English — the agent controls the browser, fills forms, scrapes data.',
    badges: ['MCP SERVER', 'MULTI-LLM'],
    status: { label: '3 models active', items: ['Claude Opus 4.6: ready', 'Gemini 3: ready', 'GPT-4.1: ready'] },
  },
  {
    id: 'proxy',
    span: 'col-span-4',
    row: '',
    color: '#B5764A',
    num: '03',
    tag: 'NETWORK',
    title: 'Smart Proxy Pool',
    desc: 'Built-in proxy pool management with geo-targeting. Assign residential, datacenter, or mobile proxies to profiles. Health checks and auto-rotation included.',
    badges: ['GEO-TARGETING', 'AUTO-ROTATE'],
  },
  {
    id: 'team',
    span: 'col-span-4',
    row: '',
    color: '#8A5A44',
    num: '04',
    tag: 'TEAM',
    title: 'Team Collaboration',
    desc: 'Share profiles with your team. Role-based access control, activity logs, and real-time sync. Everyone works on the same profiles without conflicts.',
    badges: ['RBAC', 'AUDIT LOGS'],
  },
  {
    id: 'mcp',
    span: 'col-span-4',
    row: '',
    color: '#1A1A1A',
    num: '05',
    tag: 'DEVELOPER',
    title: 'MCP Server Built-in',
    desc: 'Craft Agents comes with an MCP server pre-installed. Connect it to Claude Code, Gemini CLI, or Codex — automate browser profiles from your terminal.',
    badges: ['CLAUDE CODE', 'GEMINI CLI'],
  },
]

/* ── Section 02: Use Cases ── */
const USE_CASES = [
  {
    bg: '#8B7B6B',
    dotColor: '#C5CEBD',
    tag: 'E-COMMERCE',
    title: 'Shop Managers',
    desc: 'Run multiple storefronts across Amazon, Shopify, and eBay. Each store gets its own browser profile with unique fingerprint and geo-matched proxy.',
  },
  {
    bg: '#C4796B',
    dotColor: '#E8A090',
    tag: 'SCHEDULED SCRAPING',
    title: 'Researchers',
    desc: 'Scrape competitor pricing every morning, track changes over time, and organize findings in Google Sheets automatically.',
  },
  {
    bg: '#7B8BA0',
    dotColor: '#A0B0C0',
    tag: 'CONTENT + SOCIAL',
    title: 'Marketers',
    desc: 'Manage multiple social media accounts without cross-contamination. Schedule posts, track engagement, and run ad campaigns across isolated profiles.',
  },
  {
    bg: '#6B8B6B',
    dotColor: '#90B090',
    tag: 'AUTOMATION',
    title: 'Growth Hackers',
    desc: 'Automate account creation, outreach sequences, and data collection across platforms. Each workflow runs in its own isolated browser profile.',
  },
  {
    bg: '#8B7B9B',
    dotColor: '#B0A0C0',
    tag: 'TESTING',
    title: 'QA Engineers',
    desc: 'Test web apps across different browser fingerprints, geolocations, and device profiles. Catch bugs that only appear in specific environments.',
  },
]

/* ── Section 03: Agent Feature Cards ── */
const AGENT_FEATURES = [
  {
    tag: 'AGENT',
    tagColor: '#5B7553',
    title: 'Skills',
    desc: 'Steer agent behavior with reusable instructions written in plain Markdown. Comes pre-installed with 12 skills — Deep Research, Form Fill, Data Extract, and more.',
    badges: ['PRE-INSTALLED', 'CUSTOM', 'REUSABLE'],
  },
  {
    tag: 'AGENT',
    tagColor: '#7B6B8A',
    title: 'SOUL.md',
    desc: "Define your agent's personality, values, and communication style in a single Markdown file. Every session starts by reading its soul — so it always knows who it is.",
    badges: ['PERSONALITY', 'VALUES', 'STYLE'],
  },
  {
    tag: 'AUTOMATION',
    tagColor: '#B5764A',
    title: 'Scheduled Tasks',
    desc: 'Set any task to run on autopilot. Daily, hourly, or every few minutes. Runs in a hidden window so it never interrupts your work.',
    badges: ['DAILY', 'HOURLY', 'MINUTES'],
  },
  {
    tag: 'AGENT',
    tagColor: '#8A5A44',
    title: 'Agent Memory',
    desc: 'Your agent remembers context across sessions — preferences, past decisions, running notes. All stored locally as plain files you can read and edit.',
    badges: ['PERSISTENT', 'LOCAL', 'EDITABLE'],
  },
  {
    tag: 'POWER',
    tagColor: '#5B7553',
    title: 'Filesystem Access',
    desc: 'Give the agent access to a local folder. Research the web and save reports. Read spreadsheets and fill forms. All sandboxed to the folder you choose.',
    badges: ['READ', 'WRITE', 'RUN'],
    badgeHighlight: 'SANDBOXED',
  },
  {
    tag: 'YOU',
    tagColor: '#7B6B8A',
    title: 'Suggest a Feature',
    desc: 'What feature would you like to see in Craft Agents? Join our Discord and let us know.',
    badges: ['SUGGESTED FEATURES'],
    light: true,
  },
]

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-6" style={{ fontFamily: 'var(--font-mono-display)' }}>
      <span className="text-xs text-[var(--ink-light)]">[ {num} ]</span>
      <span className="w-8 h-px bg-[var(--ink-light)] opacity-40" />
      <span className="text-xs tracking-[0.15em] uppercase text-[var(--ink-light)]">{label}</span>
    </div>
  )
}

function FeatureCard({ card }: { card: typeof FEATURE_CARDS[number] }) {
  return (
    <div className={`${card.span} ${card.row} border border-[var(--color-divider)] bg-white p-6 flex flex-col group hover:shadow-md transition-shadow`}>
      <div className="flex flex-col gap-3 mt-auto h-full justify-between">
        <div className="mt-auto">
          <span className="text-xs tracking-[0.1em]" style={{ fontFamily: 'var(--font-mono-display)', color: card.color }}>
            {card.num} // {card.tag}
          </span>
          <h3
            className="text-lg font-light mt-1 mb-2 transition-colors"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
          >
            {card.title}
          </h3>
          <p className="text-sm text-[var(--ink-light)] leading-relaxed">{card.desc}</p>
        </div>
        {card.status && (
          <div className="mt-3 text-xs" style={{ fontFamily: 'var(--font-mono-display)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[var(--ink)]">{card.status.label}</span>
            </div>
            {card.status.items.map((item) => (
              <div key={item} className="text-[var(--ink-light)] ml-3.5">&gt; {item}</div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2" style={{ fontFamily: 'var(--font-mono-display)' }}>
          {card.badges.map((b) => (
            <span key={b} className="text-[10px] tracking-[0.08em] uppercase text-[var(--ink-light)] border border-[var(--color-divider)] px-2 py-0.5">
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentFeatureCard({ card }: { card: typeof AGENT_FEATURES[number] }) {
  return (
    <div
      className={`border border-[var(--color-divider)] p-5 flex flex-col gap-3 ${card.light ? 'bg-[var(--color-surface-offset)] opacity-70' : 'bg-white'}`}
      style={{ minHeight: 220 }}
    >
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: card.tagColor }} />
          <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--ink-light)]" style={{ fontFamily: 'var(--font-mono-display)' }}>
            {card.tag}
          </span>
        </div>
        {card.badgeHighlight && (
          <span className="text-[9px] tracking-[0.08em] uppercase border border-[var(--ink)] px-1.5 py-0.5 text-[var(--ink)]" style={{ fontFamily: 'var(--font-mono-display)' }}>
            {card.badgeHighlight}
          </span>
        )}
      </div>
      <h3 className="text-xl font-light" style={{ fontFamily: 'var(--font-serif)' }}>{card.title}</h3>
      <p className="text-sm text-[var(--ink-light)] leading-relaxed flex-1">{card.desc}</p>
      <div className="flex gap-2 mt-auto" style={{ fontFamily: 'var(--font-mono-display)' }}>
        {card.badges.map((b) => (
          <span key={b} className="text-[9px] tracking-[0.05em] uppercase text-[var(--ink-light)]">
            {b}{card.badges.indexOf(b) < card.badges.length - 1 ? ' /' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const installCmd = 'brew install craft-agents'

  return (
    <>
      {/* ══ Hero ══ */}
      <div className="w-full max-w-[1200px] mx-auto bg-white border border-[var(--ink)] grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden">
        <div className="p-10 lg:p-16 flex flex-col lg:border-r border-[var(--ink)]">
          <h1
            className="text-[clamp(2.5rem,5vw,5rem)] font-normal italic leading-[0.95] tracking-[-0.03em] mb-10 max-w-[90%]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            The Anti-Detect Browser,{' '}
            <em>Reimagined</em>
          </h1>

          <div className="flex flex-col gap-4 mt-auto">
            <span
              className="text-xs tracking-[0.12em] uppercase text-[var(--ink-light)]"
              style={{ fontFamily: 'var(--font-mono-display)' }}
            >
              Get Started
            </span>
            <p className="text-sm text-[var(--ink-light)] leading-relaxed max-w-md">
              Manage hundreds of browser profiles with unique fingerprints.
              Collaborate with your team, automate with AI, and stay undetected.
            </p>

            <div className="flex items-center gap-2">
              <code
                className="flex-1 min-w-0 text-xs bg-[var(--color-surface-offset)] px-3 py-2 border border-[var(--ink)] select-all cursor-text"
                style={{ fontFamily: 'var(--font-mono-display)' }}
              >
                {installCmd}
              </code>
              <CopyButton text={installCmd} />
            </div>

            <div className="flex gap-6 items-center mt-1">
              <Link href="/download" className="text-[var(--ink)] no-underline inline-flex items-center gap-2 border-b border-[var(--ink)] pb-0.5 transition-opacity hover:opacity-60 text-sm">
                Download <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
              </Link>
              <a href="https://github.com/nicepkg/craft-agents" target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] no-underline inline-flex items-center gap-2 border-b border-[var(--ink)] pb-0.5 transition-opacity hover:opacity-60 text-sm">
                GitHub <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
              </a>
              <Link href="/docs" className="text-[var(--ink)] no-underline inline-flex items-center gap-2 border-b border-[var(--ink)] pb-0.5 transition-opacity hover:opacity-60 text-sm">
                Docs <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
              </Link>
            </div>
          </div>
        </div>
        <RetroComputer />
      </div>

      {/* ══ Section 01: Features ══ */}
      <section id="features" className="w-full py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionLabel num="01" label="Features" />
          <h2
            className="font-light leading-none tracking-[-0.03em] mb-2"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}
          >
            Manage.<br />
            <span className="italic" style={{ color: '#7B6B8A' }}>Automate.</span><br />
            Scale.
          </h2>
          <p className="text-sm leading-relaxed mb-12 max-w-md" style={{ fontFamily: 'var(--font-mono-display)', color: '#666' }}>
            Your browser, supercharged with fingerprints and AI agents.
            From one profile to thousands — without getting detected.
          </p>

          <div className="grid grid-cols-12 gap-4">
            {FEATURE_CARDS.map((card) => (
              <FeatureCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ Section 02: Use Cases (dark) ══ */}
      <section id="use-cases" className="w-full py-14 md:py-24 overflow-hidden" style={{ backgroundColor: 'var(--ink)' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center gap-3 mb-6" style={{ fontFamily: 'var(--font-mono-display)' }}>
            <span className="text-xs text-[#888]">[ 02 ]</span>
            <span className="w-8 h-px bg-[#555]" />
            <span className="text-xs tracking-[0.15em] uppercase text-[#888]">Use Cases</span>
          </div>
          <h2
            className="mb-4 font-light leading-[0.95] tracking-[-2px] text-white"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 6vw, 3rem)' }}
          >
            Built for<span className="block italic"> every role.</span>
          </h2>
          <p className="text-sm mb-10" style={{ fontFamily: 'var(--font-mono-display)', color: '#888' }}>
            From e-commerce sellers to growth hackers — real workflows powered by Craft Agents.
          </p>

          <UseCasesCarousel cases={USE_CASES} />
        </div>
      </section>

      {/* ══ Section 03: Agent Features ══ */}
      <section id="agent-features" className="w-full py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionLabel num="03" label="Agent Features" />
          <h2
            className="mb-4 font-light leading-[0.95] tracking-[-2px]"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 6vw, 3rem)' }}
          >
            A smarter agent<span className="italic"> built into your browser.</span>
          </h2>
          <p className="text-sm mb-12" style={{ fontFamily: 'var(--font-mono-display)', color: '#666' }}>
            Memory, personality, and automation — all running locally.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENT_FEATURES.map((card) => (
              <AgentFeatureCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="w-full py-16 md:py-24" style={{ backgroundColor: 'var(--color-surface-offset)' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8 items-start">
            <div>
              <span
                className="text-xs tracking-[0.12em] uppercase text-[var(--ink-light)] font-semibold"
                style={{ fontFamily: 'var(--font-mono-display)' }}
              >
                Open Source
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[var(--ink)] leading-relaxed max-w-lg">
                Craft Agents is free and open source. Built on Chromium with
                privacy-first defaults. Run it on your machine, own your data.
              </p>
              <div className="flex gap-6 items-center">
                <Link
                  href="/download"
                  className="inline-flex items-center min-h-[50px] border border-[var(--ink)] bg-[var(--ink)] text-[var(--color-bg)] px-5 text-sm cursor-pointer transition-opacity hover:opacity-90 no-underline"
                >
                  Download for Free
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center min-h-[50px] border border-[var(--ink)] bg-transparent text-[var(--ink)] px-5 text-sm cursor-pointer transition-opacity hover:opacity-70 no-underline"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

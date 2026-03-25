'use client'

import { useState } from 'react'
import './browseros-styles.css'

const FAQS = [
  {
    q: 'What makes Craft Agents different from other anti-detect browsers?',
    a: 'Craft Agents is built on a custom Chromium fork with fingerprint spoofing at the engine level — not through extensions or JavaScript patches. This means Canvas, WebGL, audio, fonts, and 50+ signals are modified deep inside the browser, making detection virtually impossible.',
  },
  {
    q: 'What AI models does Craft Agents support?',
    a: 'Craft Agents supports any LLM through its built-in MCP server. Out of the box, it works with Claude (Opus, Sonnet), GPT-4, Gemini, and Kimi K2.5. You can also connect local models via Ollama or any OpenAI-compatible API.',
  },
  {
    q: 'What operating systems does Craft Agents support?',
    a: 'Craft Agents is available for macOS (Apple Silicon and Intel), Windows (x64), and Linux (x64). All platforms receive the same features and updates simultaneously.',
  },
  {
    q: 'Is Craft Agents compatible with Chrome extensions?',
    a: 'Yes! Craft Agents is a Chromium fork, so all your favorite Chrome extensions work seamlessly. You can import bookmarks, passwords, and extensions from Chrome easily.',
  },
  {
    q: 'How much does Craft Agents cost?',
    a: 'Craft Agents is free and open source. The core browser with fingerprinting, proxy management, and AI agent is completely free. We offer optional paid plans for team collaboration, cloud sync, and priority support.',
  },
  {
    q: 'How does Craft Agents compare to AdsPower or Multilogin?',
    a: 'Unlike AdsPower and Multilogin, Craft Agents is open source and implements fingerprinting at the Chromium engine level rather than through JavaScript injection. This provides stronger anti-detection. Plus, our built-in AI agent and MCP server integration are unique features.',
  },
  {
    q: 'Can I connect Craft Agents to Claude Code or Gemini CLI?',
    a: 'Absolutely! Craft Agents comes with a pre-installed MCP server. Connect it to Claude Code, Gemini CLI, or OpenAI Codex to automate browser profiles directly from your terminal. No extra setup required.',
  },
  {
    q: 'Is Craft Agents really open source?',
    a: "Yes! We're fully open source. You can view the code, contribute through our GitHub repository, join our Discord community, or submit feature requests. We believe browsers should be transparent and user-controlled.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: '#fff',
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 16,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          gap: 24,
        }}
      >
        <span>{q}</span>
        <div
          style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'transform 0.3s',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </button>
      <div
        style={{
          maxHeight: open ? 300 : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s, opacity 0.3s',
        }}
      >
        <p style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 14, lineHeight: 1.6,
          color: 'rgba(255,255,255,0.65)',
          paddingBottom: 20, maxWidth: 800,
        }}>
          {a}
        </p>
      </div>
    </div>
  )
}

export default function FaqSection() {
  return (
    <section id="faq" style={{ width: '100%', background: '#0f0f0f', padding: '56px 20px 96px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Section label */}
        <div className="font-space" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.15em' }}>
          <span>[ 04 ]</span>
          <span style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
          <span style={{ textTransform: 'uppercase' }}>FAQ</span>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 56 }}>
          <h2 className="font-heading" style={{
            fontWeight: 300, lineHeight: 0.95, letterSpacing: '-2px',
            fontSize: 'clamp(2rem, 6vw, 3.5rem)', color: '#fff', marginBottom: 12,
          }}>
            Frequently asked <span style={{ fontStyle: 'italic' }}>questions.</span>
          </h2>
          <p className="font-space" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Everything you need to know about Craft Agents.
          </p>
        </div>

        {/* FAQ items */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

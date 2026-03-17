'use client'

import { Activity, Fingerprint, Globe, Users } from 'lucide-react'

const stats = [
  { label: 'Profiles', value: '—', icon: Fingerprint },
  { label: 'Team Members', value: '—', icon: Users },
  { label: 'Active Proxies', value: '—', icon: Globe },
  { label: 'Actions Today', value: '—', icon: Activity },
]

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-6 rounded-xl border border-divider bg-surface shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <stat.icon className="w-5 h-5 text-primary" />
              <span className="text-sm text-text-muted">{stat.label}</span>
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-foreground">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-divider bg-surface shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Recent Activity
          </h2>
          <p className="text-sm text-text-faint">
            Activity will appear here once you start using Craft Agents.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-divider bg-surface shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-text-faint">
              Connect your Electron desktop app to enable cloud sync and team
              features.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

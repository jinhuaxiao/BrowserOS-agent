'use client'

import { Activity, Fingerprint, Globe, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DashboardStats {
  profiles: number
  members: number
  proxies: number
  actionsToday: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Profiles', value: stats?.profiles ?? 0, icon: Fingerprint },
    { label: 'Team Members', value: stats?.members ?? 0, icon: Users },
    { label: 'Active Proxies', value: stats?.proxies ?? 0, icon: Globe },
    { label: 'Actions Today', value: stats?.actionsToday ?? 0, icon: Activity },
  ]

  return (
    <div>
      <h1 className="mb-8 font-bold text-2xl text-foreground">Dashboard</h1>

      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-divider bg-surface p-6 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-primary" />
              <span className="text-sm text-text-muted">{stat.label}</span>
            </div>
            <div className="font-bold font-mono text-3xl text-foreground tabular-nums">
              {loading ? (
                <span className="inline-block h-8 w-8 animate-pulse rounded bg-surface-offset" />
              ) : (
                stat.value
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-divider bg-surface p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground text-lg">
            Recent Activity
          </h2>
          <p className="text-sm text-text-faint">
            Activity will appear here once you start using Craft Agents.
          </p>
        </div>

        <div className="rounded-xl border border-divider bg-surface p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground text-lg">
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

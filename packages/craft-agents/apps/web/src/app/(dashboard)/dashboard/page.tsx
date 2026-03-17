'use client'

import {
  Activity,
  Fingerprint,
  Globe,
  Laptop,
  Monitor,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePresence } from '@/hooks/use-presence'

interface DashboardStats {
  profiles: number
  members: number
  proxies: number
  actionsToday: number
}

function formatUptime(connectedAt: number): string {
  const seconds = Math.floor((Date.now() - connectedAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function getOsIcon(os?: string) {
  if (
    os?.toLowerCase().includes('mac') ||
    os?.toLowerCase().includes('darwin')
  ) {
    return <Laptop className="h-4 w-4" />
  }
  return <Monitor className="h-4 w-4" />
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { members: allMembers, isConnected } = usePresence()
  const members = allMembers.filter((m) => !m.deviceId.startsWith('web-'))

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
        {/* Online Devices */}
        <div className="rounded-xl border border-divider bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-lg">
              Online Devices
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-400'}`}
              />
              <span className="text-text-faint text-xs">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-text-faint">
              {isConnected
                ? 'No devices online. Start the Electron desktop app to see it here.'
                : 'Connecting to real-time server...'}
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.deviceId}
                  className="flex items-center gap-3 rounded-lg bg-surface-offset p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                    {getOsIcon(member.os)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground text-sm">
                        {member.hostname || member.deviceId}
                      </span>
                      <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                    </div>
                    <div className="flex items-center gap-3 text-text-faint text-xs">
                      {member.os && <span>{member.os}</span>}
                      {member.appVersion && <span>v{member.appVersion}</span>}
                      <span>Up {formatUptime(member.connectedAt)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-medium font-mono text-foreground text-sm tabular-nums">
                      {member.runningProfiles?.length ?? 0}
                    </div>
                    <div className="text-text-faint text-xs">profiles</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
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

/**
 * DashboardPage
 *
 * Overview dashboard for the browser profile management platform.
 * Shows profile stats, proxy health, quick actions, and team activity.
 */

import {
  GlobeIcon,
  Loader2Icon,
  MonitorSmartphoneIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SquareIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { BrowserProfileConfig, SavedProxy } from '../../shared/types'

interface DashboardStats {
  totalProfiles: number
  runningProfiles: number
  totalProxies: number
  healthyProxies: number
  unhealthyProxies: number
  platforms: Record<string, number>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const [profiles, proxies, running] = await Promise.all([
        window.electronAPI.listBrowserProfiles() as Promise<BrowserProfileConfig[]>,
        window.electronAPI.listProxies() as Promise<SavedProxy[]>,
        window.electronAPI.getRunningProfiles() as Promise<string[]>,
      ])

      const platforms: Record<string, number> = {}
      for (const p of profiles) {
        const platform = p.platform || 'other'
        platforms[platform] = (platforms[platform] || 0) + 1
      }

      setStats({
        totalProfiles: profiles.length,
        runningProfiles: running.length,
        totalProxies: proxies.length,
        healthyProxies: proxies.filter((p) => p.status === 'healthy').length,
        unhealthyProxies: proxies.filter((p) => p.status === 'unhealthy').length,
        platforms,
      })
    } catch (err) {
      console.error('Failed to load dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleQuickAction = async (action: string) => {
    setActionLoading(action)
    try {
      switch (action) {
        case 'health-check':
          await window.electronAPI.checkAllProxiesHealth()
          break
        case 'stop-all':
          await window.electronAPI.stopAllBrowsers()
          break
      }
      await loadStats()
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="h-6 w-6 animate-spin text-foreground/30" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-foreground/50 text-sm">
            Browser profile management overview
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<MonitorSmartphoneIcon className="h-5 w-5" />}
            label="Total Profiles"
            value={stats?.totalProfiles ?? 0}
            color="text-accent"
          />
          <StatCard
            icon={<PlayIcon className="h-5 w-5" />}
            label="Running"
            value={stats?.runningProfiles ?? 0}
            color="text-green-500"
          />
          <StatCard
            icon={<GlobeIcon className="h-5 w-5" />}
            label="Proxies"
            value={stats?.totalProxies ?? 0}
            color="text-blue-500"
          />
          <StatCard
            icon={<ShieldCheckIcon className="h-5 w-5" />}
            label="Healthy Proxies"
            value={stats?.healthyProxies ?? 0}
            subtitle={
              stats?.unhealthyProxies
                ? `${stats.unhealthyProxies} unhealthy`
                : undefined
            }
            color="text-emerald-500"
          />
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold text-sm">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('health-check')}
              disabled={actionLoading === 'health-check'}
            >
              {actionLoading === 'health-check' ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="mr-2 h-4 w-4" />
              )}
              Check All Proxies
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction('stop-all')}
              disabled={actionLoading === 'stop-all'}
            >
              <SquareIcon className="mr-2 h-4 w-4" />
              Stop All Browsers
            </Button>
          </div>
        </div>

        {/* Platform Distribution */}
        {stats && Object.keys(stats.platforms).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold text-sm">
              Platform Distribution
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.platforms)
                .sort(([, a], [, b]) => b - a)
                .map(([platform, count]) => (
                  <div
                    key={platform}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <span className="text-sm font-medium capitalize">
                      {platform}
                    </span>
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  subtitle?: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-foreground/50 text-xs">{label}</div>
          {subtitle && (
            <div className="text-destructive text-xs">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  )
}

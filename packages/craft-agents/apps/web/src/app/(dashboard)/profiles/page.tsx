'use client'

import { Fingerprint } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Profile {
  id: string
  name: string
  platform: string
  browserEngine: string | null
  tags: string[]
  fingerprint: {
    screen?: { width?: number; height?: number }
    navigator?: { userAgent?: string }
  }
  config: Record<string, unknown>
  updatedAt: string
  createdAt: string
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)

  // First fetch orgId from stats, then fetch profiles
  useEffect(() => {
    fetch('/api/v1/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.orgId) {
          setOrgId(data.orgId)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!orgId) return
    fetch(`/api/v1/profiles?orgId=${orgId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  if (loading) {
    return (
      <div>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-bold text-2xl text-foreground">Profiles</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-divider bg-surface"
            />
          ))}
        </div>
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-bold text-2xl text-foreground">Profiles</h1>
        </div>
        <div className="rounded-xl border border-divider bg-surface p-12 text-center shadow-sm">
          <Fingerprint className="mx-auto mb-4 h-12 w-12 text-text-faint" />
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            No profiles yet
          </h2>
          <p className="mx-auto max-w-md text-sm text-text-faint">
            Create profiles in the Craft Agents desktop app. They will
            automatically sync and appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-bold text-2xl text-foreground">Profiles</h1>
        <span className="text-sm text-text-muted">
          {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-divider bg-surface shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-divider border-b text-left">
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Platform
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Engine
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Screen
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {profiles.map((profile) => (
              <tr
                key={profile.id}
                className="transition-colors hover:bg-surface-offset"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
                    <span className="max-w-[200px] truncate font-medium text-foreground text-sm">
                      {profile.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  {profile.platform || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  {profile.browserEngine || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-text-muted">
                  {profile.fingerprint?.screen?.width &&
                  profile.fingerprint?.screen?.height
                    ? `${profile.fingerprint.screen.width}x${profile.fingerprint.screen.height}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(profile.tags || []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-block rounded-full bg-primary-light px-2 py-0.5 text-primary text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-faint">
                  {formatRelativeTime(profile.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-text-faint text-xs">
        Profiles are read-only. Use the desktop app to edit or launch profiles.
      </p>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

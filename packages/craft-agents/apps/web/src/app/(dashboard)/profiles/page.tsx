'use client'

import { Camera, FileText, Fingerprint, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMcpCall } from '@/hooks/use-mcp'
import { usePresence } from '@/hooks/use-presence'

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

interface ModalState {
  type: 'screenshot' | 'content'
  profileName: string
  loading: boolean
  data?: string
  error?: string
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)

  const { members, isConnected, wsRef, registerHandler } = usePresence()
  const { callTool } = useMcpCall(wsRef, registerHandler)

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

  const findRunningDevice = (profileId: string) => {
    return members.find((m) => m.runningProfiles?.includes(profileId))
  }

  const handleScreenshot = async (profileId: string, profileName: string) => {
    const device = findRunningDevice(profileId)
    if (!device) return

    setModal({ type: 'screenshot', profileName, loading: true })
    const result = await callTool(
      device.deviceId,
      profileId,
      'browser_get_screenshot',
    )

    if (result.success) {
      const data = result.data as {
        content?: { data?: string; type?: string }[]
      }
      const imageContent = data?.content?.find(
        (c: { type?: string }) => c.type === 'image',
      )
      if (imageContent?.data) {
        setModal({
          type: 'screenshot',
          profileName,
          loading: false,
          data: imageContent.data,
        })
      } else {
        setModal({
          type: 'screenshot',
          profileName,
          loading: false,
          error: 'No image in response',
        })
      }
    } else {
      setModal({
        type: 'screenshot',
        profileName,
        loading: false,
        error: result.error || 'Failed',
      })
    }
  }

  const handleGetContent = async (profileId: string, profileName: string) => {
    const device = findRunningDevice(profileId)
    if (!device) return

    setModal({ type: 'content', profileName, loading: true })
    const result = await callTool(
      device.deviceId,
      profileId,
      'browser_get_page_content',
    )

    if (result.success) {
      const data = result.data as { content?: { text?: string }[] }
      const textContent = data?.content?.find(
        (c: { type?: string }) => c.type === 'text',
      )
      setModal({
        type: 'content',
        profileName,
        loading: false,
        data: textContent?.text || JSON.stringify(result.data, null, 2),
      })
    } else {
      setModal({
        type: 'content',
        profileName,
        loading: false,
        error: result.error || 'Failed',
      })
    }
  }

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
        <div className="flex items-center gap-3">
          {isConnected && (
            <span className="flex items-center gap-1.5 text-text-faint text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
          )}
          <span className="text-sm text-text-muted">
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-divider bg-surface shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-divider border-b text-left">
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Platform
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Screen
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {profiles.map((profile) => {
              const device = findRunningDevice(profile.id)
              const isRunning = !!device

              return (
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
                  <td className="px-4 py-3">
                    {isRunning ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-green-600 text-xs">
                          {device.hostname || 'Running'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-faint text-xs">Offline</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {profile.platform || '—'}
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
                  <td className="px-4 py-3">
                    {isRunning && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleScreenshot(profile.id, profile.name)
                          }
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-offset hover:text-foreground"
                          title="Screenshot"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleGetContent(profile.id, profile.name)
                          }
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-offset hover:text-foreground"
                          title="Page Content"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Result Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-xl">
            <div className="flex items-center justify-between border-divider border-b px-6 py-4">
              <h3 className="font-semibold text-foreground">
                {modal.type === 'screenshot' ? 'Screenshot' : 'Page Content'} —{' '}
                {modal.profileName}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-offset hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(80vh-64px)] overflow-auto p-6">
              {modal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-text-muted">Loading...</div>
                </div>
              ) : modal.error ? (
                <div className="rounded-lg bg-red-50 p-4 text-red-600 text-sm">
                  {modal.error}
                </div>
              ) : modal.type === 'screenshot' ? (
                // biome-ignore lint/performance/noImgElement: base64 data URI
                <img
                  src={`data:image/png;base64,${modal.data}`}
                  alt="Browser screenshot"
                  className="w-full rounded-lg border border-divider"
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface-offset p-4 font-mono text-foreground text-sm">
                  {modal.data}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function _formatRelativeTime(dateStr: string): string {
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

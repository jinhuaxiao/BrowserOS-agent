'use client'

import { Laptop, Monitor, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePresence } from '@/hooks/use-presence'

interface MemberData {
  member: {
    id: string
    organizationId: string
    userId: string
    role: string
    status: string
    displayName: string | null
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export default function TeamPage() {
  const [members, setMembers] = useState<MemberData[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const { members: onlineMembers } = usePresence()

  useEffect(() => {
    // Fetch orgs first, then members
    fetch('/api/v1/orgs')
      .then((res) => (res.ok ? res.json() : []))
      .then((orgs: { id: string }[]) => {
        if (orgs.length > 0) {
          setOrgId(orgs[0].id)
          return fetch(`/api/v1/members?orgId=${orgs[0].id}`)
        }
        return null
      })
      .then((res) => (res?.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMembers(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isUserOnline = (userId: string) =>
    onlineMembers.some((m) => m.userId === userId)

  const getUserDevices = (userId: string) =>
    onlineMembers.filter((m) => m.userId === userId)

  if (loading) {
    return (
      <div>
        <h1 className="mb-8 font-bold text-2xl text-foreground">Team</h1>
        <div className="text-sm text-text-muted">Loading...</div>
      </div>
    )
  }

  if (!orgId || members.length === 0) {
    return (
      <div>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-bold text-2xl text-foreground">Team</h1>
        </div>

        <div className="rounded-xl border border-divider bg-surface p-12 text-center shadow-sm">
          <Users className="mx-auto mb-4 h-12 w-12 text-text-faint" />
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            Set up your team
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-text-faint">
            Create an organization to invite team members, assign roles, and
            share browser profiles.
          </p>
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 font-medium text-sm text-text-inverse transition-colors hover:bg-primary-hover"
          >
            Create Organization
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-bold text-2xl text-foreground">Team</h1>
        <div className="flex items-center gap-2 text-sm text-text-faint">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          {onlineMembers.length} online
        </div>
      </div>

      <div className="space-y-3">
        {members.map(({ member, user }) => {
          const online = isUserOnline(user.id)
          const devices = getUserDevices(user.id)

          return (
            <div
              key={member.id}
              className="flex items-center gap-4 rounded-xl border border-divider bg-surface p-4 shadow-sm"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light font-medium text-primary text-sm">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span
                  className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                    online ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="rounded-full bg-surface-offset px-2 py-0.5 text-text-faint text-xs">
                    {member.role}
                  </span>
                </div>
                <div className="text-sm text-text-faint">{user.email}</div>
              </div>

              {/* Devices */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {devices.length > 0 ? (
                  devices.map((device) => (
                    <div
                      key={device.deviceId}
                      className="flex items-center gap-1.5 rounded-lg bg-surface-offset px-2 py-1 text-text-muted text-xs"
                      title={`${device.hostname || device.deviceId} - ${device.runningProfiles?.length ?? 0} profiles running`}
                    >
                      {device.os?.toLowerCase().includes('mac') ? (
                        <Laptop className="h-3 w-3" />
                      ) : (
                        <Monitor className="h-3 w-3" />
                      )}
                      <span>{device.hostname || 'Device'}</span>
                      {(device.runningProfiles?.length ?? 0) > 0 && (
                        <span className="rounded-full bg-primary px-1.5 text-text-inverse">
                          {device.runningProfiles?.length}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-text-faint text-xs">Offline</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * ActivityLogPanel
 *
 * Displays a chronological list of team activity events (profile launches,
 * member changes, etc.) for the organization.
 */

import { Clock } from 'lucide-react'
import * as React from 'react'
import type { ActivityLog } from '../../../../shared/types'

interface ActivityLogPanelProps {
  organizationId: string
}

const ACTION_LABELS: Record<string, string> = {
  'profile.launch': 'Launched profile',
  'profile.stop': 'Stopped profile',
  'profile.create': 'Created profile',
  'profile.delete': 'Deleted profile',
  'profile.update': 'Updated profile',
  'member.invite': 'Invited member',
  'member.update': 'Updated member',
  'member.disable': 'Disabled member',
  'member.remove': 'Removed member',
  'group.create': 'Created group',
  'group.delete': 'Deleted group',
  'group.update': 'Updated group',
  'proxy.create': 'Created proxy',
  'proxy.delete': 'Deleted proxy',
  'org.update': 'Updated organization',
  'assignment.create': 'Assigned profile',
  'assignment.delete': 'Unassigned profile',
}

export function ActivityLogPanel({ organizationId }: ActivityLogPanelProps) {
  const [logs, setLogs] = React.useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const loadLogs = async () => {
      setIsLoading(true)
      try {
        const result = await window.electronAPI.teamListActivityLogs(
          organizationId,
          { limit: 100 },
        )
        setLogs(result)
      } catch (err) {
        console.error('Failed to load activity logs:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadLogs()
  }, [organizationId])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading activity logs...</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Clock className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 border-foreground/5 border-b px-4 py-3"
          >
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-foreground/20" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">
                  {ACTION_LABELS[log.action] || log.action}
                </span>{' '}
                <span className="text-muted-foreground">
                  ({log.targetType}: {log.targetId.slice(0, 8)}...)
                </span>
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

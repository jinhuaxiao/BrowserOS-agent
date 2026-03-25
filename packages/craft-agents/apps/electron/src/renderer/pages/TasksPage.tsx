/**
 * TasksPage
 *
 * Task queue for automated browser operations.
 * Shows running, completed, and failed tasks from BrowserAgent.
 */

import {
  CheckCircleIcon,
  ClockIcon,
  Loader2Icon,
  ListTodoIcon,
  PlayIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

type TaskStatus = 'running' | 'completed' | 'failed' | 'pending'

interface AgentTask {
  id: string
  name: string
  description: string
  status: TaskStatus
  profileIds?: string[]
  progress?: number
  result?: string
  error?: string
  createdAt: number
  completedAt?: number
}

const STATUS_CONFIG: Record<TaskStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending: {
    icon: <ClockIcon className="h-4 w-4" />,
    color: 'text-foreground/50',
    label: 'Pending',
  },
  running: {
    icon: <Loader2Icon className="h-4 w-4 animate-spin" />,
    color: 'text-blue-500',
    label: 'Running',
  },
  completed: {
    icon: <CheckCircleIcon className="h-4 w-4" />,
    color: 'text-green-500',
    label: 'Completed',
  },
  failed: {
    icon: <XCircleIcon className="h-4 w-4" />,
    color: 'text-red-500',
    label: 'Failed',
  },
}

export default function TasksPage() {
  const [tasks] = useState<AgentTask[]>([])
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter)

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
            <p className="mt-1 text-foreground/50 text-sm">
              Automated browser operations and batch tasks
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'running', 'pending', 'completed', 'failed'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === status
                  ? 'bg-accent/10 text-accent'
                  : 'text-foreground/50 hover:bg-foreground/5'
              }`}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
              {status !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  {tasks.filter((t) => t.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <ListTodoIcon className="mb-4 h-12 w-12 text-foreground/20" />
            <h2 className="font-semibold text-lg">No tasks yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-foreground/50 text-sm">
              Use the AI Agent to create automated tasks like batch profile creation,
              proxy health checks, or data collection workflows.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                // Navigate to agent page
                window.dispatchEvent(
                  new CustomEvent('navigate', { detail: { route: 'agent' } }),
                )
              }}
            >
              <PlayIcon className="mr-2 h-4 w-4" />
              Open AI Agent
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const statusConfig = STATUS_CONFIG[task.status]
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div className={statusConfig.color}>{statusConfig.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{task.name}</div>
                    <div className="truncate text-foreground/50 text-xs">
                      {task.description}
                    </div>
                    {task.error && (
                      <div className="mt-1 text-destructive text-xs">
                        {task.error}
                      </div>
                    )}
                  </div>
                  <div className="text-foreground/30 text-xs">
                    {new Date(task.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

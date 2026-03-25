/**
 * AcceleratorSettings
 *
 * Settings panel for managing network accelerator nodes (SS/SSH).
 * Allows users to configure acceleration channels for proxy traffic.
 */

import {
  CheckCircleIcon,
  CircleIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  XCircleIcon,
  ZapIcon,
  ZapOffIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  AcceleratorNode,
  AcceleratorStatus,
  CreateAcceleratorInput,
} from '../../../../shared/types'

const STATUS_CONFIG: Record<
  AcceleratorStatus,
  { icon: React.ReactNode; color: string; label: string }
> = {
  healthy: {
    icon: <CheckCircleIcon className="w-3.5 h-3.5" />,
    color: 'text-green-500',
    label: 'Healthy',
  },
  unhealthy: {
    icon: <XCircleIcon className="w-3.5 h-3.5" />,
    color: 'text-red-500',
    label: 'Unhealthy',
  },
  unknown: {
    icon: <CircleIcon className="w-3.5 h-3.5" />,
    color: 'text-foreground/50',
    label: 'Unknown',
  },
  checking: {
    icon: <Loader2Icon className="w-3.5 h-3.5 animate-spin" />,
    color: 'text-blue-500',
    label: 'Checking',
  },
}

const ACCELERATOR_TYPES = [
  { value: 'ss', label: 'Shadowsocks' },
  { value: 'ssh', label: 'SSH Tunnel' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'http', label: 'HTTP' },
] as const

const SS_CIPHERS = [
  'aes-256-gcm',
  'aes-128-gcm',
  'chacha20-ietf-poly1305',
  'xchacha20-ietf-poly1305',
] as const

interface AcceleratorSettingsProps {
  className?: string
}

export function AcceleratorSettings({ className }: AcceleratorSettingsProps) {
  const [nodes, setNodes] = useState<AcceleratorNode[]>([])
  const [loading, setLoading] = useState(true)
  const [gostAvailable, setGostAvailable] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)

  const loadNodes = useCallback(async () => {
    try {
      const [list, available] = await Promise.all([
        window.electronAPI.listAccelerators(),
        window.electronAPI.isGostAvailable(),
      ])
      setNodes(list)
      setGostAvailable(available)
    } catch (err) {
      console.error('Failed to load accelerators:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNodes()
  }, [loadNodes])

  const handleHealthCheck = useCallback(async (id: string) => {
    setCheckingId(id)
    try {
      const result = await window.electronAPI.checkAcceleratorHealth(id)
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                status: result.status,
                responseTimeMs: result.responseTimeMs,
                lastCheckedAt: result.checkedAt,
                errorMessage: result.errorMessage,
              }
            : n,
        ),
      )
    } finally {
      setCheckingId(null)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await window.electronAPI.deleteAccelerator(id)
    setNodes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handleAdd = useCallback(async (input: CreateAcceleratorInput) => {
    const node = await window.electronAPI.createAccelerator(input)
    setNodes((prev) => [...prev, node])
    setShowAddForm(false)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2Icon className="w-5 h-5 animate-spin text-foreground/50" />
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ZapIcon className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">Network Acceleration</span>
          {!gostAvailable && (
            <span className="text-xs text-foreground/50 bg-foreground/5 px-2 py-0.5 rounded">
              gost not installed
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(true)}
          disabled={!gostAvailable}
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Node
        </Button>
      </div>

      <p className="text-xs text-foreground/50 mb-4">
        Configure acceleration nodes to optimize cross-border proxy connections.
        Traffic flows: Browser → Accelerator → Landing Proxy → Target.
      </p>

      {/* Node List */}
      {nodes.length === 0 && !showAddForm ? (
        <div className="text-center py-6 text-foreground/50 text-sm">
          <ZapOffIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No accelerator nodes configured
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => {
            const status =
              checkingId === node.id
                ? STATUS_CONFIG.checking
                : STATUS_CONFIG[node.status]
            return (
              <div
                key={node.id}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={status.color}>{status.icon}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {node.name}
                    </div>
                    <div className="text-xs text-foreground/50">
                      {node.type.toUpperCase()} · {node.host}:{node.port}
                      {node.responseTimeMs != null && (
                        <span className="ml-2">{node.responseTimeMs}ms</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleHealthCheck(node.id)}
                    disabled={checkingId === node.id}
                  >
                    <RefreshCwIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(node.id)}
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <AddAcceleratorForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

// Inline add form
function AddAcceleratorForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: CreateAcceleratorInput) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<CreateAcceleratorInput['type']>('ss')
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [password, setPassword] = useState('')
  const [cipher, setCipher] = useState<string>('aes-256-gcm')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name || !host || !port) return
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        type,
        host,
        port: parseInt(port, 10),
        username: username || undefined,
        password: password || undefined,
        cipher:
          type === 'ss'
            ? (cipher as CreateAcceleratorInput['cipher'])
            : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 p-4 rounded-lg border border-border bg-card space-y-3">
      <div className="text-sm font-medium">Add Accelerator Node</div>

      {/* Type */}
      <div className="flex gap-2">
        {ACCELERATOR_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              type === t.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-foreground/50 hover:border-accent/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 px-3 py-1.5 text-sm rounded-md border border-border bg-background"
        />
        <input
          placeholder="Host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
        />
        <input
          placeholder="Port"
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
        />
        {(type === 'ssh' || type === 'socks5' || type === 'http') && (
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        )}
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
        />
        {type === 'ss' && (
          <select
            value={cipher}
            onChange={(e) => setCipher(e.target.value)}
            className="col-span-2 px-3 py-1.5 text-sm rounded-md border border-border bg-background"
          >
            {SS_CIPHERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!name || !host || !port || submitting}
        >
          {submitting && (
            <Loader2Icon className="w-3.5 h-3.5 mr-1 animate-spin" />
          )}
          Add
        </Button>
      </div>
    </div>
  )
}

/**
 * AgentPage
 *
 * AI assistant for browser profile management.
 * Features: model selector, streaming chat, tool execution display.
 */

import {
  BotIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  Loader2Icon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  isError?: boolean
  timestamp: number
}

interface AuthStatus {
  hasApiKey: boolean
  claudeCodeInstalled: boolean
  authSource: 'env' | 'claude-code' | 'none'
  subscriptionType?: string
}

interface ModelInfo {
  provider: string
  id: string
  name: string
}

// Curated model groups for the selector
const MODEL_GROUPS = [
  {
    label: 'Recommended',
    models: [
      { provider: 'anthropic', id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { provider: 'anthropic', id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { provider: 'anthropic', id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    label: 'Previous Generation',
    models: [
      { provider: 'anthropic', id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { provider: 'anthropic', id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
      { provider: 'anthropic', id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4' },
    ],
  },
]

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [selectedModel, setSelectedModel] = useState('claude-opus-4-6')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  // Check auth status on mount
  useEffect(() => {
    window.electronAPI.agentAuthStatus?.()
      .then((status: AuthStatus) => setAuthStatus(status))
      .catch(() => {})
  }, [])

  // Close model menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Listen for agent events
  useEffect(() => {
    const cleanup = window.electronAPI.onAgentEvent((event: any) => {
      switch (event.type) {
        case 'text_delta':
          setStreamingText((prev) => prev + event.text)
          break
        case 'tool_call':
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-call-${Date.now()}-${Math.random()}`,
              role: 'tool',
              content: `Calling ${event.name}...`,
              toolName: event.name,
              timestamp: Date.now(),
            },
          ])
          break
        case 'tool_result':
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-result-${Date.now()}-${Math.random()}`,
              role: 'tool',
              content: event.result,
              toolName: event.name,
              isError: event.isError,
              timestamp: Date.now(),
            },
          ])
          break
        case 'complete':
          setStreamingText((prev) => {
            if (prev) {
              setMessages((msgs) => [
                ...msgs,
                {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: prev,
                  timestamp: Date.now(),
                },
              ])
            }
            return ''
          })
          setIsStreaming(false)
          break
        case 'error':
          setStreamingText('')
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: event.error,
              isError: true,
              timestamp: Date.now(),
            },
          ])
          setIsStreaming(false)
          break
      }
    })
    return () => cleanup()
  }, [])

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streamingText])

  const handleModelChange = useCallback(async (modelId: string) => {
    setSelectedModel(modelId)
    setShowModelMenu(false)
    const group = MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === modelId)
    if (group) {
      await window.electronAPI.agentSetModel(group.provider, group.id)
    }
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    // Set model before first message
    const group = MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === selectedModel)
    if (group) {
      await window.electronAPI.agentSetModel(group.provider, group.id)
    }

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() },
    ])

    try {
      await window.electronAPI.agentChat(text)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
          timestamp: Date.now(),
        },
      ])
      setIsStreaming(false)
    }
  }, [input, isStreaming, selectedModel])

  const handleStop = useCallback(() => {
    window.electronAPI.agentStop()
    setIsStreaming(false)
    setStreamingText('')
  }, [])

  const handleClear = useCallback(() => {
    window.electronAPI.agentClear()
    setMessages([])
    setStreamingText('')
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentModelName = MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === selectedModel)?.name || selectedModel

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Messages Area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Empty State */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center pt-[15vh]">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <BotIcon className="h-7 w-7 text-accent" />
              </div>
              <h2 className="mb-2 font-semibold text-xl">Browser Agent</h2>
              <p className="mb-8 max-w-md text-center text-foreground/50 text-sm">
                Manage browser profiles, proxies, and automate tasks with natural language.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'List all profiles',
                  'Check proxy health',
                  'Create 3 Amazon US profiles',
                  'Show running profiles',
                  'Import proxies from clipboard',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-border px-4 py-2 text-sm transition-all hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-5">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[75%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-white">
                      {msg.content}
                    </div>
                  </div>
                ) : msg.role === 'tool' ? (
                  <div className="ml-1">
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-xs">
                      <WrenchIcon className="h-3 w-3 text-foreground/40" />
                      <span className="font-medium text-foreground/60">{msg.toolName}</span>
                      {msg.isError && <XCircleIcon className="h-3 w-3 text-destructive" />}
                    </div>
                    {msg.content && msg.content !== `Calling ${msg.toolName}...` && (
                      <div className={`ml-1 mt-1.5 rounded-lg border px-3 py-2 font-mono text-xs ${
                        msg.isError
                          ? 'border-destructive/20 bg-destructive/5 text-destructive'
                          : 'border-border bg-foreground/[0.02] text-foreground/70'
                      }`}>
                        <pre className="whitespace-pre-wrap">{msg.content}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm ${
                      msg.isError
                        ? 'border border-destructive/20 bg-destructive/5 text-destructive'
                        : 'bg-foreground/[0.04] text-foreground'
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming text */}
            {isStreaming && streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-foreground/[0.04] px-4 py-3 text-sm">
                  <div className="whitespace-pre-wrap leading-relaxed">{streamingText}</div>
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-accent" />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isStreaming && !streamingText && messages[messages.length - 1]?.role !== 'tool' && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-foreground/[0.04] px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/30" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/30" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/30" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {/* Input Box */}
          <div className="rounded-2xl border border-border bg-card shadow-sm transition-colors focus-within:border-accent/50">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent to manage profiles, proxies, or automate tasks..."
              className="w-full resize-none rounded-t-2xl border-0 bg-transparent px-4 pt-3 pb-2 text-sm focus:outline-none"
              rows={2}
              disabled={isStreaming}
            />
            {/* Bottom bar: model selector + actions */}
            <div className="flex items-center justify-between px-3 pb-2">
              {/* Model Selector */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
                >
                  <BotIcon className="h-3.5 w-3.5" />
                  <span>{currentModelName}</span>
                  <ChevronDownIcon className="h-3 w-3" />
                </button>

                {showModelMenu && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-border bg-card py-1 shadow-lg">
                    {MODEL_GROUPS.map((group) => (
                      <div key={group.label}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/30">
                          {group.label}
                        </div>
                        {group.models.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => handleModelChange(model.id)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/5 ${
                              selectedModel === model.id ? 'text-accent' : 'text-foreground/70'
                            }`}
                          >
                            <span>{model.name}</span>
                            {selectedModel === model.id && (
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                    {/* Auth status */}
                    {authStatus && (
                      <div className="border-t border-border px-3 py-2">
                        <span className={`text-[10px] ${authStatus.hasApiKey ? 'text-green-500' : 'text-foreground/30'}`}>
                          {authStatus.hasApiKey
                            ? authStatus.authSource === 'claude-code'
                              ? `✓ Claude Code (${authStatus.subscriptionType})`
                              : '✓ API Key'
                            : '✗ No API key configured'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-foreground/30 hover:text-foreground/60"
                    onClick={handleClear}
                    title="Clear conversation"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isStreaming ? (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-xl"
                    onClick={handleStop}
                  >
                    <SquareIcon className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-xl"
                    onClick={handleSend}
                    disabled={!input.trim()}
                  >
                    <SendIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

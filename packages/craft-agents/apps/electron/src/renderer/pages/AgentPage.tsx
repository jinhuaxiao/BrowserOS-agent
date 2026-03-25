/**
 * AgentPage
 *
 * AI assistant for browser profile management.
 * Connected to BrowserAgent (pi-mono) via IPC for real tool execution.
 */

import {
  BotIcon,
  CheckCircleIcon,
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

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Listen for agent events from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onAgentEvent((event: any) => {
      switch (event.type) {
        case 'text_delta':
          setStreamingText((prev) => prev + event.text)
          break
        case 'thinking_delta':
          // Optionally show thinking
          break
        case 'tool_call':
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-call-${Date.now()}`,
              role: 'tool',
              content: `Calling: ${event.name}(${JSON.stringify(event.args).slice(0, 200)})`,
              toolName: event.name,
              timestamp: Date.now(),
            },
          ])
          break
        case 'tool_result':
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-result-${Date.now()}`,
              role: 'tool',
              content: event.result,
              toolName: event.name,
              isError: event.isError,
              timestamp: Date.now(),
            },
          ])
          break
        case 'complete':
          // Flush streaming text as assistant message
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
    cleanupRef.current = cleanup
    return () => cleanup()
  }, [])

  // Check auth status on mount
  useEffect(() => {
    window.electronAPI.agentAuthStatus?.()
      .then((status: AuthStatus) => setAuthStatus(status))
      .catch(() => {})
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streamingText])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])

    // Call BrowserAgent via IPC — events come back via onAgentEvent
    try {
      await window.electronAPI.agentChat(text)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `IPC Error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
          timestamp: Date.now(),
        },
      ])
      setIsStreaming(false)
    }
  }, [input, isStreaming])

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <BotIcon className="h-5 w-5 text-accent" />
          <div>
            <h1 className="font-bold text-lg">AI Agent</h1>
            <p className="text-foreground/50 text-xs">
              Manage profiles, proxies, and automate browser tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {authStatus && (
            <span className={`flex items-center gap-1 text-xs ${authStatus.hasApiKey ? 'text-green-500' : 'text-foreground/40'}`}>
              {authStatus.hasApiKey ? (
                <>
                  <CheckCircleIcon className="h-3 w-3" />
                  {authStatus.authSource === 'claude-code'
                    ? `Claude Code (${authStatus.subscriptionType || 'oauth'})`
                    : 'API Key'}
                </>
              ) : (
                <>
                  <XCircleIcon className="h-3 w-3" />
                  No API key
                </>
              )}
            </span>
          )}
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-4 py-6">
          {messages.length === 0 && !isStreaming && (
            <div className="py-20 text-center">
              <BotIcon className="mx-auto mb-4 h-12 w-12 text-foreground/20" />
              <h2 className="font-semibold text-lg">Browser Agent</h2>
              <p className="mx-auto mt-2 max-w-md text-foreground/50 text-sm">
                Try commands like &quot;List all profiles&quot;, &quot;Create 5
                Amazon US profiles&quot;, or &quot;Check proxy health&quot;
              </p>
              <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
                {[
                  'List all profiles',
                  'Check proxy health',
                  'Create an Amazon profile',
                  'Show running profiles',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-white'
                    : msg.isError
                      ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                      : msg.role === 'tool'
                        ? 'border border-border bg-foreground/5'
                        : 'border border-border bg-card'
                }`}
              >
                {msg.toolName && (
                  <div className="mb-1.5 flex items-center gap-1.5 font-medium text-xs opacity-60">
                    <WrenchIcon className="h-3 w-3" />
                    {msg.toolName}
                  </div>
                )}
                <div className={`whitespace-pre-wrap ${msg.role === 'tool' ? 'font-mono text-xs' : ''}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isStreaming && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <div className="whitespace-pre-wrap">{streamingText}</div>
                <span className="inline-block h-4 w-1 animate-pulse bg-foreground/50" />
              </div>
            </div>
          )}

          {isStreaming && !streamingText && messages[messages.length - 1]?.role !== 'tool' && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <Loader2Icon className="h-4 w-4 animate-spin text-foreground/50" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to manage profiles, proxies, or automate tasks..."
            className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-accent focus:outline-none"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={handleStop}
            >
              <SquareIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * AgentPage
 *
 * AI assistant for browser profile management.
 * Uses BrowserAgent (pi-mono) for multi-model chat with tool calling.
 */

import {
  BotIcon,
  Loader2Icon,
  SendIcon,
  SquareIcon,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
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

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      // TODO: Connect to BrowserAgent IPC when available
      // For now, show a placeholder response
      await new Promise((r) => setTimeout(r, 500))

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content:
          'BrowserAgent is ready but not yet connected to the IPC layer. ' +
          'The agent backend (pi-mono + browser-tools) is implemented in the shared package. ' +
          'IPC integration will connect this UI to the BrowserAgent class.',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsStreaming(false)
      setStreamingText('')
    }
  }, [input, isStreaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <BotIcon className="h-5 w-5 text-accent" />
          <div>
            <h1 className="font-bold text-lg">AI Agent</h1>
            <p className="text-foreground/50 text-xs">
              Manage profiles, proxies, and automate browser tasks with natural
              language
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-4 py-6">
          {messages.length === 0 && (
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
                        ? 'border border-border bg-foreground/5 font-mono text-xs'
                        : 'border border-border bg-card'
                }`}
              >
                {msg.toolName && (
                  <div className="mb-1 font-semibold text-xs opacity-60">
                    Tool: {msg.toolName}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
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

          {isStreaming && !streamingText && (
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
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={isStreaming ? undefined : handleSend}
            disabled={!input.trim() && !isStreaming}
          >
            {isStreaming ? (
              <SquareIcon className="h-4 w-4" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

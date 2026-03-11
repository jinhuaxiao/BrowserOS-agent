export interface TrackedRequest {
  id: string
  action: string
  startTime: number
  status: 'pending' | 'executing' | 'completed' | 'failed'
  duration?: number
  error?: string
}

export interface RequestStats {
  inFlight: number
  avgDuration: number
  errorRate: number
  totalRequests: number
}

export class RequestTracker {
  private requests = new Map<string, TrackedRequest>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  start(id: string, action: string): void {
    this.requests.set(id, {
      id,
      action,
      startTime: Date.now(),
      status: 'pending',
    })
  }

  markExecuting(id: string): void {
    const req = this.requests.get(id)
    if (req) req.status = 'executing'
  }

  complete(id: string, error?: string): void {
    const req = this.requests.get(id)
    if (req) {
      req.status = error ? 'failed' : 'completed'
      req.duration = Date.now() - req.startTime
      req.error = error
      setTimeout(() => this.requests.delete(id), 60000)
    }
  }

  getStats(): RequestStats {
    const all = Array.from(this.requests.values())
    const inFlight = all.filter(
      (r) => r.status === 'pending' || r.status === 'executing',
    ).length
    const completed = all.filter(
      (r): r is typeof r & { duration: number } => r.duration !== undefined,
    )
    const avgDuration =
      completed.length > 0
        ? completed.reduce((sum, r) => sum + r.duration, 0) / completed.length
        : 0
    const failed = all.filter((r) => r.status === 'failed').length
    const errorRate = all.length > 0 ? failed / all.length : 0

    return {
      inFlight,
      avgDuration: Math.round(avgDuration),
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: all.length,
    }
  }

  private cleanup(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    for (const [id, req] of this.requests.entries()) {
      if (
        (req.status === 'completed' || req.status === 'failed') &&
        req.startTime < fiveMinutesAgo
      ) {
        this.requests.delete(id)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.requests.clear()
  }
}

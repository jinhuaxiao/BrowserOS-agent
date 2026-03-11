import type { ProtocolRequest } from '../protocol/types'
import { ProtocolRequestSchema } from '../protocol/types'

export class RequestValidator {
  private activeIds = new Set<string>()
  private idTimestamps = new Map<string, number>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  validate(message: unknown): ProtocolRequest {
    const request = ProtocolRequestSchema.parse(message)

    if (this.activeIds.has(request.id)) {
      throw new Error(
        `Duplicate request ID: ${request.id}. Already processing this request.`,
      )
    }

    this.activeIds.add(request.id)
    this.idTimestamps.set(request.id, Date.now())
    return request
  }

  markComplete(id: string): void {
    this.activeIds.delete(id)
    this.idTimestamps.delete(id)
  }

  private cleanup(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    for (const [id, timestamp] of this.idTimestamps.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.activeIds.delete(id)
        this.idTimestamps.delete(id)
      }
    }
  }

  getStats(): { activeIds: number } {
    return { activeIds: this.activeIds.size }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.activeIds.clear()
    this.idTimestamps.clear()
  }
}

import type { ProtocolResponse } from '../protocol/types'
import { logger } from './logger'

export class ResponseQueue {
  private queue: ProtocolResponse[] = []
  private maxSize: number

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  enqueue(response: ProtocolResponse): void {
    if (this.queue.length >= this.maxSize) {
      const dropped = this.queue.shift()
      logger.warn(
        `Response queue full. Dropped oldest response: ${dropped?.id}`,
      )
    }
    this.queue.push(response)
  }

  flush(send: (response: ProtocolResponse) => void): number {
    let sent = 0
    while (this.queue.length > 0) {
      const response = this.queue.shift()
      if (!response) break
      try {
        send(response)
        sent++
      } catch (error) {
        logger.error(
          `Failed to send response ${response.id}: ${error}. Re-queueing.`,
        )
        this.queue.unshift(response)
        break
      }
    }
    return sent
  }

  size(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue = []
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }
}

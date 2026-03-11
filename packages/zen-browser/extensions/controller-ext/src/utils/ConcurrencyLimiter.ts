import { logger } from './logger'

interface QueuedTask<T> {
  task: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

export interface ConcurrencyStats {
  inFlight: number
  queued: number
  utilization: number
}

export class ConcurrencyLimiter {
  private isProcessing = false
  private queue: Array<QueuedTask<unknown>> = []

  constructor(
    maxConcurrent: number,
    private maxQueueSize = 1000,
  ) {
    if (maxConcurrent !== 1) {
      logger.warn(
        `ConcurrencyLimiter: maxConcurrent=${maxConcurrent} but extension is single-threaded. Using mutex mode.`,
      )
    }
    logger.info(
      `ConcurrencyLimiter initialized: sequential=true, queueSize=${maxQueueSize}`,
    )
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueSize) {
      logger.error(
        `Queue full (${this.maxQueueSize} requests). Rejecting request.`,
      )
      throw new Error(
        `Controller overloaded. Queue full (${this.maxQueueSize} requests).`,
      )
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      if (!this.isProcessing) {
        this.processQueue()
      }
    })
  }

  private processQueue(): void {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    const item = this.queue.shift()
    if (!item) {
      this.isProcessing = false
      return
    }

    const { task, resolve, reject } = item

    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.isProcessing = false
        this.processQueue()
      })
  }

  getStats(): ConcurrencyStats {
    return {
      inFlight: this.isProcessing ? 1 : 0,
      queued: this.queue.length,
      utilization: this.isProcessing ? 1.0 : 0.0,
    }
  }
}

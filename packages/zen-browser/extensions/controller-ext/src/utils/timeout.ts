export class APITimeoutError extends Error {
  constructor(
    public operation: string,
    public timeoutMs: number,
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`)
    this.name = 'APITimeoutError'
  }
}

export const API_TIMEOUTS = {
  BROWSER_API: 15_000,
  DOM_ACTION: 10_000,
  HEAVY_ACTION: 60_000,
} as const

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new APITimeoutError(operation, timeoutMs))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

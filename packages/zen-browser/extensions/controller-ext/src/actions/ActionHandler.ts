import { z } from 'zod'
import type { ActionResponse } from '../protocol/types'
import { logger } from '../utils/logger'

export type { ActionResponse }

export abstract class ActionHandler<TInput = unknown, TOutput = unknown> {
  abstract readonly inputSchema: z.ZodSchema<TInput>
  abstract execute(input: TInput): Promise<TOutput>

  async handle(payload: unknown): Promise<ActionResponse> {
    const actionName = this.constructor.name

    try {
      const validatedInput = this.inputSchema.parse(payload)
      const result = await this.execute(validatedInput)
      return { ok: true, data: result }
    } catch (error) {
      const errorMessage = this._formatError(error)
      logger.error(`[${actionName}] Action failed: ${errorMessage}`)
      return { ok: false, error: errorMessage }
    }
  }

  protected _formatError(error: unknown): string {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e: z.ZodIssue) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : ''
        return `${path}${e.message}`
      })
      return `Validation error: ${errors.join(', ')}`
    }
    if (error instanceof Error) return error.message
    return String(error)
  }
}

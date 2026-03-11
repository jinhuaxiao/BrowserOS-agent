import { logger } from '../utils/logger'
import type { ActionHandler, ActionResponse } from './ActionHandler'

export class ActionRegistry {
  private handlers = new Map<string, ActionHandler>()

  register(actionName: string, handler: ActionHandler): void {
    this.handlers.set(actionName, handler)
  }

  async dispatch(
    actionName: string,
    payload: unknown,
  ): Promise<ActionResponse> {
    const handler = this.handlers.get(actionName)

    if (!handler) {
      const available = Array.from(this.handlers.keys()).join(', ')
      return {
        ok: false,
        error: `Unknown action: "${actionName}". Available: ${available || 'none'}`,
      }
    }

    try {
      return await handler.handle(payload)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Unexpected error in "${actionName}": ${errorMessage}`)
      return { ok: false, error: `Action execution failed: ${errorMessage}` }
    }
  }

  getAvailableActions(): string[] {
    return Array.from(this.handlers.keys())
  }

  hasAction(actionName: string): boolean {
    return this.handlers.has(actionName)
  }
}

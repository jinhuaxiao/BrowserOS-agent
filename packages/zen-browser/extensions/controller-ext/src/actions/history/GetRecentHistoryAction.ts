import { z } from 'zod'
import { HistoryAdapter } from '../../adapters/HistoryAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z
  .object({
    maxResults: z.number().optional(),
    hoursBack: z.number().optional(),
  })
  .optional()

export class GetRecentHistoryAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private historyAdapter = new HistoryAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    return this.historyAdapter.getRecentHistory(
      input?.maxResults,
      input?.hoursBack,
    )
  }
}

import { z } from 'zod'
import { HistoryAdapter } from '../../adapters/HistoryAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
})

export class SearchHistoryAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private historyAdapter = new HistoryAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    return this.historyAdapter.searchHistory(
      input.query,
      input.maxResults,
      input.startTime,
      input.endTime,
    )
  }
}

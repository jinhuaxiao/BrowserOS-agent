import { z } from 'zod'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ tabId: z.number() })

export class CloseTabAction extends ActionHandler<z.infer<typeof InputSchema>> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    await this.tabAdapter.closeTab(input.tabId)
    return { closed: input.tabId }
  }
}

import { z } from 'zod'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ windowId: z.number().optional() }).optional()

export class GetActiveTabAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    const tab = await this.tabAdapter.getActiveTab(input?.windowId)
    return {
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      windowId: tab.windowId,
    }
  }
}

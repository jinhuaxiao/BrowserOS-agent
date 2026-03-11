import { z } from 'zod'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ tabId: z.number() })

export class SwitchTabAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    const tab = await this.tabAdapter.switchTab(input.tabId)
    return { tabId: tab.id, url: tab.url, title: tab.title }
  }
}

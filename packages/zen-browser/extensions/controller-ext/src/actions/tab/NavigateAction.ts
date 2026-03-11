import { z } from 'zod'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({
  url: z.string(),
  tabId: z.number().optional(),
})

export class NavigateAction extends ActionHandler<z.infer<typeof InputSchema>> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    let tabId = input.tabId
    if (!tabId) {
      const activeTab = await this.tabAdapter.getActiveTab()
      tabId = activeTab.id!
    }
    const tab = await this.tabAdapter.navigateTab(tabId, input.url)
    return { tabId: tab.id, url: input.url }
  }
}

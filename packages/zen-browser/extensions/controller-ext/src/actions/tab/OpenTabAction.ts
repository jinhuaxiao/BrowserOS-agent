import { z } from 'zod'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z
  .object({
    url: z.string().optional(),
    active: z.boolean().optional(),
    windowId: z.number().optional(),
  })
  .optional()

export class OpenTabAction extends ActionHandler<z.infer<typeof InputSchema>> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    const tab = await this.tabAdapter.openTab(
      input?.url,
      input?.active ?? true,
      input?.windowId,
    )
    return { tabId: tab.id, url: tab.url, windowId: tab.windowId }
  }
}

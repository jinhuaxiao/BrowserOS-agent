import { z } from 'zod'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z
  .object({
    windowId: z.number().optional(),
    url: z.string().optional(),
    title: z.string().optional(),
  })
  .optional()

export class GetTabsAction extends ActionHandler<z.infer<typeof InputSchema>> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    let tabs: browser.tabs.Tab[]
    if (input?.windowId) {
      tabs = await this.tabAdapter.queryTabs({ windowId: input.windowId })
    } else {
      tabs = await this.tabAdapter.getAllTabs()
    }

    if (input?.url) {
      const pattern = input.url.toLowerCase()
      tabs = tabs.filter((t) => t.url?.toLowerCase().includes(pattern))
    }
    if (input?.title) {
      const pattern = input.title.toLowerCase()
      tabs = tabs.filter((t) => t.title?.toLowerCase().includes(pattern))
    }

    const tabInfos = tabs
      .filter(
        (t): t is browser.tabs.Tab & { id: number; windowId: number } =>
          t.id !== undefined && t.windowId !== undefined,
      )
      .map((t) => ({
        id: t.id,
        url: t.url || '',
        title: t.title || '',
        active: t.active || false,
        windowId: t.windowId,
        index: t.index,
      }))

    return {
      tabs: tabInfos,
      count: tabInfos.length,
    }
  }
}

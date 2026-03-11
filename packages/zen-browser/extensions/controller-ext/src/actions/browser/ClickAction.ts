import { z } from 'zod'
import { DOMAdapter } from '../../adapters/DOMAdapter'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ nodeId: z.number() })

export class ClickAction extends ActionHandler<z.infer<typeof InputSchema>> {
  readonly inputSchema = InputSchema
  private tabAdapter = new TabAdapter()
  private domAdapter = DOMAdapter.getInstance()

  async execute(input: z.infer<typeof InputSchema>) {
    const tab = await this.tabAdapter.getActiveTab()
    if (!tab.id) throw new Error('Active tab has no ID')
    await this.domAdapter.click(tab.id, input.nodeId)
    return { clicked: input.nodeId }
  }
}

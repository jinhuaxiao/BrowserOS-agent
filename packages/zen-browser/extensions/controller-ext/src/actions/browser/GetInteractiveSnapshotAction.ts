import { z } from 'zod'
import { DOMAdapter } from '../../adapters/DOMAdapter'
import { TabAdapter } from '../../adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({}).optional()

export class GetInteractiveSnapshotAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema

  private tabAdapter = new TabAdapter()
  private domAdapter = DOMAdapter.getInstance()

  async execute() {
    const tab = await this.tabAdapter.getActiveTab()
    if (!tab.id) throw new Error('Active tab has no ID')
    return this.domAdapter.getInteractiveSnapshot(tab.id)
  }
}

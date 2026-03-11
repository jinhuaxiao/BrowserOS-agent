import { z } from 'zod'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({}).optional()

export class CheckBrowserOSAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema

  async execute() {
    return {
      available: true,
      browser: 'firefox',
      engine: 'gecko',
      extensionVersion: browser.runtime.getManifest().version,
    }
  }
}

import { z } from 'zod'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z
  .object({
    url: z.string().optional(),
    incognito: z.boolean().optional(),
  })
  .optional()

export class CreateWindowAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema

  async execute(input: z.infer<typeof InputSchema>) {
    const options: browser.windows._CreateCreateData = {}
    if (input?.url) options.url = input.url
    if (input?.incognito) options.incognito = input.incognito
    const window = await browser.windows.create(options)
    return {
      windowId: window.id,
      tabs: window.tabs?.map((t) => ({ tabId: t.id, url: t.url })),
    }
  }
}

import { z } from 'zod'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ windowId: z.number() })

export class CloseWindowAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema

  async execute(input: z.infer<typeof InputSchema>) {
    await browser.windows.remove(input.windowId)
    return { closed: input.windowId }
  }
}

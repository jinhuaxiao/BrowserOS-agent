import { z } from 'zod'
import { BookmarkAdapter } from '../../adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ id: z.string(), confirm: z.boolean() })

export class RemoveBookmarkTreeAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    if (!input.confirm)
      throw new Error('Must set confirm: true to delete bookmark tree')
    await this.bookmarkAdapter.removeBookmarkTree(input.id)
    return { removed: input.id }
  }
}

import { z } from 'zod'
import { BookmarkAdapter } from '../../adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({ id: z.string() })

export class RemoveBookmarkAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    await this.bookmarkAdapter.removeBookmark(input.id)
    return { removed: input.id }
  }
}

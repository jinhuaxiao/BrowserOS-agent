import { z } from 'zod'
import { BookmarkAdapter } from '../../adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({
  title: z.string(),
  url: z.string(),
  parentId: z.string().optional(),
})

export class CreateBookmarkAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    return this.bookmarkAdapter.createBookmark(input)
  }
}

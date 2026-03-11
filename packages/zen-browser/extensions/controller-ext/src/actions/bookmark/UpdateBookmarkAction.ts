import { z } from 'zod'
import { BookmarkAdapter } from '../../adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
})

export class UpdateBookmarkAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    return this.bookmarkAdapter.updateBookmark(input.id, {
      title: input.title,
      url: input.url,
    })
  }
}

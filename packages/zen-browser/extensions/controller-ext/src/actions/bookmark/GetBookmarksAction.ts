import { z } from 'zod'
import { BookmarkAdapter } from '../../adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z
  .object({
    query: z.string().optional(),
    limit: z.number().optional(),
    recent: z.boolean().optional(),
  })
  .optional()

export class GetBookmarksAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    if (input?.recent) {
      return this.bookmarkAdapter.getRecentBookmarks(input?.limit || 20)
    }
    if (input?.query) {
      const results = await this.bookmarkAdapter.searchBookmarks(input.query)
      return input?.limit ? results.slice(0, input.limit) : results
    }
    return this.bookmarkAdapter.getBookmarkTree()
  }
}

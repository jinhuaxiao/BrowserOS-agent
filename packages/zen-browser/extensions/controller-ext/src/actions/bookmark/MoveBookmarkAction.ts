import { z } from 'zod'
import { BookmarkAdapter } from '../../adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const InputSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  index: z.number().optional(),
})

export class MoveBookmarkAction extends ActionHandler<
  z.infer<typeof InputSchema>
> {
  readonly inputSchema = InputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: z.infer<typeof InputSchema>) {
    return this.bookmarkAdapter.moveBookmark(input.id, {
      parentId: input.parentId,
      index: input.index,
    })
  }
}

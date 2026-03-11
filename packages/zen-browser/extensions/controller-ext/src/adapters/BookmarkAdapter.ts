import { API_TIMEOUTS, withTimeout } from '../utils/timeout'

export class BookmarkAdapter {
  async getBookmarkTree(): Promise<browser.bookmarks.BookmarkTreeNode[]> {
    return withTimeout(
      browser.bookmarks.getTree(),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.getTree',
    )
  }

  async searchBookmarks(
    query: string,
  ): Promise<browser.bookmarks.BookmarkTreeNode[]> {
    return withTimeout(
      browser.bookmarks.search(query),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.search',
    )
  }

  async getBookmark(id: string): Promise<browser.bookmarks.BookmarkTreeNode> {
    const results = await withTimeout(
      browser.bookmarks.get(id),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.get',
    )
    if (results.length === 0) throw new Error('Bookmark not found')
    return results[0]
  }

  async createBookmark(bookmark: {
    title: string
    url: string
    parentId?: string
  }): Promise<browser.bookmarks.BookmarkTreeNode> {
    return withTimeout(
      browser.bookmarks.create(bookmark),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.create',
    )
  }

  async removeBookmark(id: string): Promise<void> {
    await withTimeout(
      browser.bookmarks.remove(id),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.remove',
    )
  }

  async updateBookmark(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<browser.bookmarks.BookmarkTreeNode> {
    return withTimeout(
      browser.bookmarks.update(id, changes),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.update',
    )
  }

  async getRecentBookmarks(
    limit = 20,
  ): Promise<browser.bookmarks.BookmarkTreeNode[]> {
    const tree = await withTimeout(
      browser.bookmarks.getTree(),
      API_TIMEOUTS.BROWSER_API,
      'bookmarks.getTree',
    )
    const bookmarks = this.flattenTree(tree)
    return bookmarks
      .filter((b) => b.url && b.dateAdded)
      .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      .slice(0, limit)
  }

  async createBookmarkFolder(options: {
    title: string
    parentId?: string
  }): Promise<browser.bookmarks.BookmarkTreeNode> {
    return browser.bookmarks.create({
      title: options.title,
      parentId: options.parentId || 'toolbar_____',
    })
  }

  async getBookmarkChildren(
    folderId: string,
  ): Promise<browser.bookmarks.BookmarkTreeNode[]> {
    return browser.bookmarks.getChildren(folderId)
  }

  async moveBookmark(
    id: string,
    destination: { parentId?: string; index?: number },
  ): Promise<browser.bookmarks.BookmarkTreeNode> {
    return browser.bookmarks.move(id, destination)
  }

  async removeBookmarkTree(id: string): Promise<void> {
    const protectedIds = [
      'root________',
      'toolbar_____',
      'menu________',
      'unfiled_____',
      'mobile______',
    ]
    if (protectedIds.includes(id)) {
      throw new Error(`Cannot delete protected bookmark folder: ${id}`)
    }
    await browser.bookmarks.removeTree(id)
  }

  private flattenTree(
    nodes: browser.bookmarks.BookmarkTreeNode[],
  ): browser.bookmarks.BookmarkTreeNode[] {
    const result: browser.bookmarks.BookmarkTreeNode[] = []
    for (const node of nodes) {
      result.push(node)
      if (node.children) result.push(...this.flattenTree(node.children))
    }
    return result
  }
}

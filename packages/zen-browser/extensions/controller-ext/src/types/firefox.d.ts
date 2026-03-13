// Firefox WebExtension API type declarations
// These provide basic typing for browser.* APIs used in the extension

declare namespace browser {
  namespace tabs {
    interface Tab {
      id?: number
      url?: string
      title?: string
      active: boolean
      windowId: number
      index: number
      status?: string
    }

    interface _QueryQueryInfo {
      active?: boolean
      currentWindow?: boolean
      windowId?: number
      url?: string | string[]
      title?: string
    }

    interface _CreateCreateProperties {
      url?: string
      active?: boolean
      windowId?: number
    }

    function query(queryInfo: _QueryQueryInfo): Promise<Tab[]>
    function get(tabId: number): Promise<Tab>
    function create(createProperties: _CreateCreateProperties): Promise<Tab>
    function remove(tabIdOrIds: number | number[]): Promise<void>
    function update(
      tabId: number,
      updateProperties: { active?: boolean; url?: string },
    ): Promise<Tab>
    function sendMessage(tabId: number, message: unknown): Promise<unknown>
    function captureVisibleTab(
      windowId: number,
      options?: { format?: string; quality?: number },
    ): Promise<string>
  }

  namespace windows {
    interface Window {
      id?: number
      tabs?: tabs.Tab[]
      type?: string
      focused: boolean
    }

    interface _CreateCreateData {
      url?: string | string[]
      incognito?: boolean
      type?: string
    }

    const WINDOW_ID_NONE: number

    function getAll(): Promise<Window[]>
    function create(createData?: _CreateCreateData): Promise<Window>
    function remove(windowId: number): Promise<void>

    const onFocusChanged: {
      addListener(callback: (windowId: number) => void): void
    }
    const onCreated: {
      addListener(callback: (window: Window) => void): void
    }
    const onRemoved: {
      addListener(callback: (windowId: number) => void): void
    }
  }

  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string
      parentId?: string
      index?: number
      url?: string
      title: string
      dateAdded?: number
      dateGroupModified?: number
      children?: BookmarkTreeNode[]
      type?: string
    }

    function getTree(): Promise<BookmarkTreeNode[]>
    function search(
      query: string | { query?: string; url?: string; title?: string },
    ): Promise<BookmarkTreeNode[]>
    function get(idOrIdList: string | string[]): Promise<BookmarkTreeNode[]>
    function create(bookmark: {
      title: string
      url?: string
      parentId?: string
    }): Promise<BookmarkTreeNode>
    function remove(id: string): Promise<void>
    function removeTree(id: string): Promise<void>
    function update(
      id: string,
      changes: { title?: string; url?: string },
    ): Promise<BookmarkTreeNode>
    function getChildren(id: string): Promise<BookmarkTreeNode[]>
    function move(
      id: string,
      destination: { parentId?: string; index?: number },
    ): Promise<BookmarkTreeNode>
  }

  namespace history {
    interface HistoryItem {
      id: string
      url?: string
      title?: string
      lastVisitTime?: number
      visitCount?: number
    }

    function search(query: {
      text: string
      maxResults?: number
      startTime?: number
      endTime?: number
    }): Promise<HistoryItem[]>
  }

  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab
      id?: string
    }

    function getManifest(): { version: string; [key: string]: unknown }
    function sendMessage(message: unknown): Promise<unknown>

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse?: (response: unknown) => void,
        ) => boolean | Promise<unknown> | undefined,
      ): void
    }

    const onInstalled: {
      addListener(callback: () => void): void
    }
  }

  namespace storage {
    namespace local {
      function get(
        keys?: string | string[] | Record<string, unknown>,
      ): Promise<Record<string, unknown>>
      function set(items: Record<string, unknown>): Promise<void>
    }
  }

  namespace webNavigation {
    const onCompleted: {
      addListener(
        callback: (details: {
          tabId: number
          url: string
          frameId: number
        }) => void,
      ): void
    }
  }
}

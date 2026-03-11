import { API_TIMEOUTS, withTimeout } from '../utils/timeout'

export class TabAdapter {
  async getActiveTab(windowId?: number): Promise<browser.tabs.Tab> {
    const query: browser.tabs._QueryQueryInfo = { active: true }
    if (windowId !== undefined) {
      query.windowId = windowId
    } else {
      query.currentWindow = true
    }
    const tabs = await withTimeout(
      browser.tabs.query(query),
      API_TIMEOUTS.BROWSER_API,
      'tabs.query',
    )
    if (tabs.length === 0) throw new Error('No active tab found')
    return tabs[0]
  }

  async getTab(tabId: number): Promise<browser.tabs.Tab> {
    return withTimeout(
      browser.tabs.get(tabId),
      API_TIMEOUTS.BROWSER_API,
      'tabs.get',
    )
  }

  async getAllTabs(): Promise<browser.tabs.Tab[]> {
    return withTimeout(
      browser.tabs.query({}),
      API_TIMEOUTS.BROWSER_API,
      'tabs.query',
    )
  }

  async queryTabs(
    query: browser.tabs._QueryQueryInfo,
  ): Promise<browser.tabs.Tab[]> {
    return withTimeout(
      browser.tabs.query(query),
      API_TIMEOUTS.BROWSER_API,
      'tabs.query',
    )
  }

  async openTab(
    url?: string,
    active = true,
    windowId?: number,
  ): Promise<browser.tabs.Tab> {
    const createProps: browser.tabs._CreateCreateProperties = {
      url: url || 'about:newtab',
      active,
    }
    if (windowId !== undefined) createProps.windowId = windowId
    const tab = await withTimeout(
      browser.tabs.create(createProps),
      API_TIMEOUTS.BROWSER_API,
      'tabs.create',
    )
    if (!tab.id) throw new Error('Created tab has no ID')
    return tab
  }

  async closeTab(tabId: number): Promise<void> {
    await withTimeout(
      browser.tabs.remove(tabId),
      API_TIMEOUTS.BROWSER_API,
      'tabs.remove',
    )
  }

  async switchTab(tabId: number): Promise<browser.tabs.Tab> {
    const tab = await withTimeout(
      browser.tabs.update(tabId, { active: true }),
      API_TIMEOUTS.BROWSER_API,
      'tabs.update',
    )
    if (!tab) throw new Error('Failed to update tab')
    return tab
  }

  async navigateTab(tabId: number, url: string): Promise<browser.tabs.Tab> {
    const tab = await withTimeout(
      browser.tabs.update(tabId, { url }),
      API_TIMEOUTS.BROWSER_API,
      'tabs.update',
    )
    if (!tab) throw new Error('Failed to update tab')
    return tab
  }
}

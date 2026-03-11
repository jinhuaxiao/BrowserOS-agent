import { API_TIMEOUTS, withTimeout } from '../utils/timeout'

export class HistoryAdapter {
  async searchHistory(
    query: string,
    maxResults = 100,
    startTime?: number,
    endTime?: number,
  ): Promise<browser.history.HistoryItem[]> {
    return withTimeout(
      browser.history.search({ text: query, maxResults, startTime, endTime }),
      API_TIMEOUTS.BROWSER_API,
      'history.search',
    )
  }

  async getRecentHistory(
    maxResults = 20,
    hoursBack = 24,
  ): Promise<browser.history.HistoryItem[]> {
    const startTime = Date.now() - hoursBack * 60 * 60 * 1000
    return withTimeout(
      browser.history.search({ text: '', maxResults, startTime }),
      API_TIMEOUTS.BROWSER_API,
      'history.search',
    )
  }
}

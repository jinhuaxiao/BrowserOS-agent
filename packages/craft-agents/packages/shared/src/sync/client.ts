import type {
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from './types'

export class SyncClient {
  private baseUrl: string
  private token: string
  private orgId: string

  constructor(baseUrl: string, token: string, orgId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
    this.orgId = orgId
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...init?.headers,
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API error ${res.status}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  async pull(since?: number): Promise<SyncPullResponse> {
    const params = new URLSearchParams({ orgId: this.orgId })
    if (since) params.set('since', String(since))
    return this.fetch(`/api/v1/sync?${params}`)
  }

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    return this.fetch('/api/v1/sync', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getProfiles(): Promise<unknown[]> {
    return this.fetch(`/api/v1/profiles?orgId=${this.orgId}`)
  }

  async getMembers(): Promise<unknown[]> {
    return this.fetch(`/api/v1/members?orgId=${this.orgId}`)
  }

  async getGroups(): Promise<unknown[]> {
    return this.fetch(`/api/v1/groups?orgId=${this.orgId}`)
  }

  async getProxies(): Promise<unknown[]> {
    return this.fetch(`/api/v1/proxies?orgId=${this.orgId}`)
  }
}

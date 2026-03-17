import { presenceTracker } from './presence'

export function pushSyncUpdate(
  orgId: string,
  entity: string,
  action: 'upsert' | 'delete',
  data: unknown,
  excludeClientId?: string,
) {
  presenceTracker.broadcastToOrg(
    orgId,
    JSON.stringify({ type: 'sync', entity, action, data }),
    excludeClientId,
  )
}

export function pushNotification(orgId: string, title: string, body: string) {
  presenceTracker.broadcastToOrg(
    orgId,
    JSON.stringify({ type: 'notification', title, body }),
  )
}

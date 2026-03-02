import { CONTENT_LIMITS } from '@browseros/shared/constants/limits'
import type { Snapshot, SnapshotItem } from './adapter'

export function formatSnapshotToMarkdown(snapshot: Snapshot): string {
  if (!snapshot?.items?.length) return ''

  const maxChars = CONTENT_LIMITS.PAGE_CONTENT_MAX_CHARS
  let result = ''

  for (const item of snapshot.items) {
    const line = formatItem(item)
    if (!line) continue

    if (result.length + line.length > maxChars) {
      result += '\n[Content truncated]'
      break
    }
    result += line
  }

  return result.trim()
}

function formatItem(item: SnapshotItem): string {
  switch (item.type) {
    case 'heading': {
      const prefix = '#'.repeat(item.level || 1)
      return `${prefix} ${item.text}\n`
    }
    case 'link':
      return item.url ? `[${item.text}](${item.url})\n` : `${item.text}\n`
    case 'text':
      return `${item.text}\n`
    default:
      return ''
  }
}

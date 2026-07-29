export function readMessageText(message = {}) {
  if (typeof message?.text === 'string') return message.text
  if (typeof message?.content === 'string') return message.content
  return ''
}

export function formatPreview(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 180 ? `${serialized.slice(0, 180)}...` : serialized
  } catch {
    return String(value)
  }
}

export function collectPayloadLines(value, {
  prefix = '',
  depth = 0,
  maxDepth = 2,
  lines = [],
  maxLines = 8,
} = {}) {
  if (lines.length >= maxLines || value == null) return lines

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (prefix) lines.push(`${prefix}: ${String(value)}`)
    return lines
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return lines
    if (depth >= maxDepth) {
      if (prefix) lines.push(`${prefix}: ${value.length} items`)
      return lines
    }
    const scalars = value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))
    if (scalars) {
      if (prefix) lines.push(`${prefix}: ${value.map((entry) => String(entry)).join(', ')}`)
      return lines
    }
    value.slice(0, 3).forEach((entry, index) => {
      collectPayloadLines(entry, {
        prefix: prefix ? `${prefix}[${index}]` : `[${index}]`,
        depth: depth + 1,
        maxDepth,
        lines,
        maxLines,
      })
    })
    return lines
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue != null && entryValue !== '')
      .filter(([key]) => !['workspace', 'catalogs', 'history', 'rawObservation', 'sessionKnowledge'].includes(key))
    for (const [key, entryValue] of entries) {
      if (lines.length >= maxLines) break
      const nextPrefix = prefix ? `${prefix}.${key}` : key
      if (
        typeof entryValue === 'string'
        || typeof entryValue === 'number'
        || typeof entryValue === 'boolean'
      ) {
        lines.push(`${nextPrefix}: ${String(entryValue)}`)
        continue
      }
      if (Array.isArray(entryValue) && entryValue.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))) {
        lines.push(`${nextPrefix}: ${entryValue.map((entry) => String(entry)).join(', ')}`)
        continue
      }
      if (depth < maxDepth) {
        collectPayloadLines(entryValue, {
          prefix: nextPrefix,
          depth: depth + 1,
          maxDepth,
          lines,
          maxLines,
        })
      } else {
        lines.push(`${nextPrefix}: ${Array.isArray(entryValue) ? `${entryValue.length} items` : '[object]'}`)
      }
    }
  }

  return lines
}

export function uniqLines(lines = []) {
  return [...new Set((Array.isArray(lines) ? lines : []).filter((line) => typeof line === 'string' && line.trim().length > 0))]
}

export function latestAssistantMessageText(agentMessages = []) {
  const safeMessages = Array.isArray(agentMessages) ? agentMessages : []
  for (let index = safeMessages.length - 1; index >= 0; index -= 1) {
    const message = safeMessages[index]
    if (message?.role !== 'assistant') continue
    const text = readMessageText(message)
    if (text.trim().length > 0) {
      return text.trim()
    }
  }
  return null
}

function compareResponseRecords(a, b) {
  const at = Date.parse(a?.createdAt || '') || 0
  const bt = Date.parse(b?.createdAt || '') || 0
  return at - bt
}

function mapResponseActorToChatRole(actor) {
  if (actor === 'human' || actor === 'user') return 'user'
  if (actor === 'system') return 'system'
  if (actor === 'error') return 'error'
  return 'assistant'
}

export function buildTraceItemsFromAgentResponses(
  responses,
  { sessionId = null } = {},
) {
  const records = Array.isArray(responses) ? [...responses] : []
  const scoped = sessionId
    ? records.filter((record) => !record?.sessionId || record.sessionId === sessionId)
    : records

  scoped.sort(compareResponseRecords)

  const items = []
  for (const record of scoped) {
    const responseId = String(record?.responseId || `runtime-response-${items.length}`)
    const query = String(record?.query || '').trim()
    const content = String(record?.content || '').trim()
    if (query) {
      items.push({
        id: `runtime-query-${responseId}`,
        type: 'user',
        role: 'user',
        content: query,
        source: 'runtime_response',
        responseId,
      })
    }
    if (content) {
      items.push({
        id: `runtime-response-${responseId}`,
        type: mapResponseActorToChatRole(record?.actor),
        role: mapResponseActorToChatRole(record?.actor),
        content,
        source: 'runtime_response',
        responseId,
      })
    }
  }

  return items
}

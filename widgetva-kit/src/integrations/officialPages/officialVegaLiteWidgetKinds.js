export function inferWidgetKindFromMark(mark) {
  const normalizedMark = typeof mark === 'string' ? mark : mark?.type
  if (normalizedMark === 'bar') return 'bar'
  if (normalizedMark === 'line') return 'line'
  if (normalizedMark === 'area') return 'line'
  if (normalizedMark === 'point' || normalizedMark === 'circle') return 'scatter'
  if (normalizedMark === 'rect') return 'heatmap'
  return null
}

export function pushUniqueKind(target, kind) {
  if (typeof kind !== 'string' || kind.length === 0) return
  if (!target.includes(kind)) {
    target.push(kind)
  }
}

export function uniqueKinds(kinds = []) {
  return [...new Set(
    (Array.isArray(kinds) ? kinds : [])
      .filter((kind) => typeof kind === 'string' && kind.length > 0),
  )]
}

export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

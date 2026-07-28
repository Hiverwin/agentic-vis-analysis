export function hasInlineObjectRows(spec) {
  return Array.isArray(spec?.data?.values)
    && spec.data.values.some((row) => row && typeof row === 'object')
}

export function readInlineRows(spec) {
  return hasInlineObjectRows(spec)
    ? spec.data.values.filter((row) => row && typeof row === 'object')
    : []
}

export function datumRef(field) {
  return `datum['${String(field).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
}

export function valueList(values = []) {
  return (Array.isArray(values) ? values : []).map((value) => JSON.stringify(value)).join(',')
}

export function uniqueValues(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

export function expressionEqualsAny(field, values = []) {
  return `indexof([${valueList(values)}], ${datumRef(field)}) >= 0`
}

export function expressionNotEqualsAny(field, values = []) {
  return `indexof([${valueList(values)}], ${datumRef(field)}) < 0`
}

export function numericExtent(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite)
  if (numbers.length === 0) return null
  return [Math.min(...numbers), Math.max(...numbers)]
}

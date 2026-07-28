export function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function ensureObjectSpec(spec, message) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error(message)
  }
  return spec
}

export function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

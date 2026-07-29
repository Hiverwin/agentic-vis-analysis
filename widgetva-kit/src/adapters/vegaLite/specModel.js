import { cloneJsonValue as cloneValue } from '../../shared/clone.js'

export { cloneValue }

export function ensureObjectSpec(spec, message) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error(message)
  }
  return spec
}

export function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

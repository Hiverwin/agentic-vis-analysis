import { ensureObjectSpec } from './specModel.js'

export function collectNestedSpecs(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return []
  const nested = []
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (Array.isArray(spec?.[key])) {
      nested.push(...spec[key].filter((entry) => entry && typeof entry === 'object'))
    }
  }
  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    nested.push(spec.spec)
  }
  return nested
}

export function findRepresentativeSpec(spec, matcher) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (matcher(spec)) return spec
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => entry && typeof entry === 'object' && matcher(entry))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedSpecs(spec)) {
    const match = findRepresentativeSpec(child, matcher)
    if (match) return match
  }
  return null
}

export function updateRepresentativeSpec(spec, matcher, updater, message) {
  ensureObjectSpec(spec, message)
  if (matcher(spec)) {
    return updater(spec)
  }

  if (Array.isArray(spec?.layer)) {
    let updated = false
    const nextLayer = spec.layer.map((entry) => {
      if (updated || !entry || typeof entry !== 'object') return entry
      if (matcher(entry)) {
        updated = true
        return updater(entry)
      }
      const nestedMatch = findRepresentativeSpec(entry, matcher)
      if (nestedMatch && nestedMatch !== entry) {
        updated = true
        return updateRepresentativeSpec(entry, matcher, updater, message)
      }
      return entry
    })
    if (updated) {
      return { ...spec, layer: nextLayer }
    }
  }

  for (const key of ['vconcat', 'hconcat', 'concat']) {
    if (!Array.isArray(spec?.[key])) continue
    let updated = false
    const nextChildren = spec[key].map((entry) => {
      if (updated || !entry || typeof entry !== 'object') return entry
      if (matcher(entry)) {
        updated = true
        return updater(entry)
      }
      const nestedMatch = findRepresentativeSpec(entry, matcher)
      if (nestedMatch && nestedMatch !== entry) {
        updated = true
        return updateRepresentativeSpec(entry, matcher, updater, message)
      }
      return entry
    })
    if (updated) {
      return { ...spec, [key]: nextChildren }
    }
  }

  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    if (matcher(spec.spec)) {
      return { ...spec, spec: updater(spec.spec) }
    }
    const nestedMatch = findRepresentativeSpec(spec.spec, matcher)
    if (nestedMatch && nestedMatch !== spec.spec) {
      return { ...spec, spec: updateRepresentativeSpec(spec.spec, matcher, updater, message) }
    }
  }

  throw new Error(message)
}

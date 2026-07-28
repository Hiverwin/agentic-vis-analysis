function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Normalize the annotation-system envelope into the provider-native spec. */
export function normalizeBenchmarkSpec(value) {
  if (!isObject(value) || !isObject(value.spec)) return value

  const keys = Object.keys(value)
  const isLegacyEnvelope = Object.prototype.hasOwnProperty.call(value, 'meta')
    && keys.every((key) => key === 'spec' || key === 'meta')

  return isLegacyEnvelope ? value.spec : value
}

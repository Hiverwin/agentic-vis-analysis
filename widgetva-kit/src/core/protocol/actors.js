function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const RUNTIME_ACTORS = ['agent', 'human', 'system']

export function describeRuntimeActorSchema() {
  return cloneValue({
    type: 'string',
    enum: RUNTIME_ACTORS,
  })
}

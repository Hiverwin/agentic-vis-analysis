export const QUERY_SCOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dataRef: { type: 'string' },
    selectionRef: { type: 'string' },
    focusRef: { type: 'string' },
    viewportRef: { type: 'string' },
  },
}

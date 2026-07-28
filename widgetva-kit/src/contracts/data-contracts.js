import {
  DATA_QUERY_KINDS,
  DATA_QUERY_RESULT_SCHEMAS,
  DATA_QUERY_SCHEMAS,
} from '../schemas/data-handles.schema.js'

export { DATA_QUERY_KINDS, DATA_QUERY_RESULT_SCHEMAS, DATA_QUERY_SCHEMAS }

export function makeDataHandle(handle) {
  return {
    sourceKind: 'inline',
    schema: { fields: [] },
    stats: {},
    kind: 'dataView',
    scope: 'workspace',
    widgetRef: undefined,
    sourceSelectionRef: undefined,
    supportedQueries: ['sampleRows', 'summary'],
    supportedQueryDescriptors: [],
    ...handle,
  }
}

export function makeDataQueryDescriptor(descriptor) {
  return {
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    resultSchema: descriptor?.resultSchema || (descriptor?.name ? DATA_QUERY_RESULT_SCHEMAS[descriptor.name] : undefined),
    examples: [],
    ...descriptor,
  }
}

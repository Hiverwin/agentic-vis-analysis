import { RUNTIME_ACTOR_SCHEMA } from './actors.schema.js'
import { QUERY_SCOPE_SCHEMA } from './query-scope.schema.js'

const DATA_QUERY_TARGET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['widgetRef'],
  properties: {
    widgetRef: { type: 'string' },
  },
}

export const DATA_QUERY_KINDS = [
  'schema',
  'sampleRows',
  'filter',
  'aggregate',
  'groupBy',
  'sql',
  'summary',
  'computeCorrelation',
  'findExtremes',
  'findOutliers',
  'compareGroups',
]

const DATA_QUERY_PREDICATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    field: { type: 'string', minLength: 1 },
    op: { type: 'string', minLength: 1 },
    value: {},
  },
  required: ['field', 'op', 'value'],
}

const DATA_QUERY_MEASURE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    op: { type: 'string' },
    field: { type: 'string' },
    as: { type: 'string' },
  },
  required: ['op'],
}

const DATA_QUERY_SQL_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sql: { type: 'string', minLength: 1 },
    text: { type: 'string', minLength: 1 },
  },
  oneOf: [{ required: ['sql'] }, { required: ['text'] }],
}

const DATA_QUERY_SUMMARY_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fields: { type: 'array', items: { type: 'string' } },
    metrics: { type: 'array', items: { type: 'string' } },
    groupBy: { type: 'array', items: { type: 'string' } },
    measures: {
      type: 'array',
      items: DATA_QUERY_MEASURE_SCHEMA,
    },
    sortBy: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        order: { type: 'string', enum: ['ascending', 'descending'] },
      },
    },
    limit: { type: 'integer', minimum: 1, maximum: 500 },
  },
}

const DATA_QUERY_CORRELATION_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    xField: { type: 'string', minLength: 1 },
    yField: { type: 'string', minLength: 1 },
  },
  required: ['xField', 'yField'],
}

const DATA_QUERY_EXTREMES_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    field: { type: 'string', minLength: 1 },
    direction: { type: 'string', enum: ['min', 'max'] },
    limit: { type: 'integer', minimum: 1, maximum: 200 },
  },
  required: ['field'],
}

const DATA_QUERY_OUTLIERS_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    field: { type: 'string', minLength: 1 },
    method: { type: 'string', enum: ['iqr', 'zscore'] },
    limit: { type: 'integer', minimum: 1, maximum: 200 },
  },
  required: ['field'],
}

const DATA_QUERY_COMPARE_GROUPS_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    groupField: { type: 'string', minLength: 1 },
    valueField: { type: 'string', minLength: 1 },
    groups: {
      type: 'array',
      minItems: 2,
      items: {},
    },
    leftGroup: {},
    rightGroup: {},
  },
  required: ['groupField', 'valueField'],
}

const DATA_QUERY_AGGREGATE_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    groupBy: { type: 'array', items: { type: 'string' } },
    measures: {
      type: 'array',
      items: DATA_QUERY_MEASURE_SCHEMA,
    },
    metrics: {
      type: 'array',
      items: DATA_QUERY_MEASURE_SCHEMA,
    },
  },
}

const DATA_QUERY_CALL_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind'],
  properties: {
    kind: { type: 'string', enum: DATA_QUERY_KINDS },
    spec: { type: 'object' },
  },
}

const DATA_RECORD_SCHEMA = {
  type: 'object',
}

const DATA_SUMMARY_ROW_SCHEMA = {
  type: 'object',
}

const DATA_GROUP_COMPARISON_SCHEMA = {
  type: ['object', 'null'],
}

const DATA_FIELD_SCHEMA = {
  type: 'object',
  required: ['name', 'type'],
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    nullable: { type: 'boolean' },
    description: { type: 'string' },
  },
}

const DATA_SCHEMA_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    fields: { type: 'array', items: DATA_FIELD_SCHEMA },
  },
}

const DATA_ROWS_RESULT_SCHEMA = {
  type: 'array',
  items: DATA_RECORD_SCHEMA,
}

const DATA_SUMMARY_TABLE_SCHEMA = {
  type: 'object',
  properties: {
    rows: { type: 'array', items: DATA_SUMMARY_ROW_SCHEMA },
  },
}

const DATA_GROUP_COMPARISON_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    groupField: { type: ['string', 'null'] },
    valueField: { type: ['string', 'null'] },
    groups: { type: 'array', items: DATA_SUMMARY_ROW_SCHEMA },
    comparison: DATA_GROUP_COMPARISON_SCHEMA,
  },
}

export const DATA_QUERY_RESULT_SCHEMAS = {
  schema: DATA_SCHEMA_RESULT_SCHEMA,
  sampleRows: DATA_ROWS_RESULT_SCHEMA,
  filter: {
    type: 'object',
    properties: {
      rows: DATA_ROWS_RESULT_SCHEMA,
      rowCount: { type: 'integer' },
      predicates: {
        type: 'array',
        items: DATA_QUERY_PREDICATE_SCHEMA,
      },
    },
  },
  aggregate: DATA_SUMMARY_TABLE_SCHEMA,
  groupBy: DATA_SUMMARY_TABLE_SCHEMA,
  sql: DATA_ROWS_RESULT_SCHEMA,
  summary: DATA_SUMMARY_TABLE_SCHEMA,
  computeCorrelation: {
    type: 'object',
    properties: {
      xField: { type: 'string' },
      yField: { type: 'string' },
      correlation: { type: ['number', 'null'] },
      sampleSize: { type: 'integer' },
    },
  },
  findExtremes: DATA_SUMMARY_TABLE_SCHEMA,
  findOutliers: DATA_SUMMARY_TABLE_SCHEMA,
  compareGroups: DATA_GROUP_COMPARISON_RESULT_SCHEMA,
}

export const DATA_QUERY_SCHEMAS = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  sampleRows: {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 500 },
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  filter: {
    type: 'object',
    additionalProperties: false,
    properties: {
      predicates: {
        type: 'array',
        minItems: 1,
        items: DATA_QUERY_PREDICATE_SCHEMA,
      },
      queryScope: QUERY_SCOPE_SCHEMA,
    },
    required: ['predicates'],
  },
  aggregate: {
    ...DATA_QUERY_AGGREGATE_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_AGGREGATE_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  groupBy: {
    ...DATA_QUERY_AGGREGATE_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_AGGREGATE_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  sql: {
    ...DATA_QUERY_SQL_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_SQL_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  summary: {
    ...DATA_QUERY_SUMMARY_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_SUMMARY_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  computeCorrelation: {
    ...DATA_QUERY_CORRELATION_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_CORRELATION_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  findExtremes: {
    ...DATA_QUERY_EXTREMES_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_EXTREMES_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  findOutliers: {
    ...DATA_QUERY_OUTLIERS_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_OUTLIERS_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
  compareGroups: {
    ...DATA_QUERY_COMPARE_GROUPS_SPEC_SCHEMA,
    properties: {
      ...DATA_QUERY_COMPARE_GROUPS_SPEC_SCHEMA.properties,
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  },
}

const DATA_QUERY_DESCRIPTOR_SCHEMA = {
  type: 'object',
  required: ['name', 'title', 'description', 'resultKind'],
  properties: {
    name: { type: 'string', enum: DATA_QUERY_KINDS },
    title: { type: 'string' },
    description: { type: 'string' },
    resultKind: { type: 'string' },
    inputSchema: { type: 'object' },
    resultSchema: { type: ['object', 'array', 'null'] },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          spec: { type: 'object' },
        },
      },
    },
  },
}

const DATA_HANDLE_SCHEMA = {
  type: 'object',
  required: ['ref', 'title', 'sourceKind', 'supportedQueries'],
  properties: {
    ref: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    sourceKind: { type: 'string' },
    kind: { type: 'string' },
    scope: { type: 'string' },
    widgetRef: { type: 'string' },
    sourceSelectionRef: { type: 'string' },
    schema: {
      ...DATA_SCHEMA_RESULT_SCHEMA,
    },
    stats: {
      type: 'object',
      properties: {
        rowCount: { type: 'integer' },
        visibleCount: { type: 'integer' },
        selectedCount: { type: 'integer' },
      },
    },
    supportedQueries: { type: 'array', items: { type: 'string', enum: DATA_QUERY_KINDS } },
    supportedQueryDescriptors: { type: 'array', items: DATA_QUERY_DESCRIPTOR_SCHEMA },
  },
}

export const DATA_QUERY_CALL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    callId: { type: 'string' },
    actor: RUNTIME_ACTOR_SCHEMA,
    target: DATA_QUERY_TARGET_SCHEMA,
    dataRef: { type: 'string' },
    query: DATA_QUERY_CALL_QUERY_SCHEMA,
  },
}

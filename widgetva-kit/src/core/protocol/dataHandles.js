import { describeRuntimeActorSchema } from './actors.js'
import { describeQueryScopeSchema } from './queryScope.js'

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

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function describeDataQueryPredicateSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      field: { type: 'string', minLength: 1 },
      op: { type: 'string', minLength: 1 },
      value: {},
    },
    required: ['field', 'op', 'value'],
  })
}

function withOptionalScopedDataTarget(schema) {
  const nextSchema = cloneValue(schema)
  const nextProperties = nextSchema.properties || {}
  return {
    ...nextSchema,
    properties: {
      ...nextProperties,
      queryScope: describeQueryScopeSchema(),
    },
  }
}

export function describeDataQueryMeasureSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      op: { type: 'string' },
      field: { type: 'string' },
      as: { type: 'string' },
    },
    required: ['op'],
  })
}

export function describeDataQuerySqlSpecSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      sql: { type: 'string', minLength: 1 },
      text: { type: 'string', minLength: 1 },
    },
    oneOf: [{ required: ['sql'] }, { required: ['text'] }],
  })
}

export function describeDataQuerySummarySpecSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      fields: { type: 'array', items: { type: 'string' } },
      metrics: { type: 'array', items: { type: 'string' } },
      groupBy: { type: 'array', items: { type: 'string' } },
      measures: {
        type: 'array',
        items: describeDataQueryMeasureSchema(),
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
  })
}

export function describeDataQueryCorrelationSpecSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      xField: { type: 'string', minLength: 1 },
      yField: { type: 'string', minLength: 1 },
    },
    required: ['xField', 'yField'],
  })
}

export function describeDataQueryExtremesSpecSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      field: { type: 'string', minLength: 1 },
      direction: { type: 'string', enum: ['min', 'max', 'both'] },
      limit: { type: 'integer', minimum: 1, maximum: 200 },
    },
    required: ['field'],
  })
}

export function describeDataQueryOutliersSpecSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      field: { type: 'string', minLength: 1 },
      method: { type: 'string', enum: ['iqr', 'zscore'] },
      limit: { type: 'integer', minimum: 1, maximum: 200 },
    },
    required: ['field'],
  })
}

export function describeDataQueryCompareGroupsSpecSchema() {
  return cloneValue({
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
  })
}

export function describeDataQueryAggregateSpecSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      groupBy: { type: 'array', items: { type: 'string' } },
      measures: {
        type: 'array',
        items: describeDataQueryMeasureSchema(),
      },
      metrics: {
        type: 'array',
        items: describeDataQueryMeasureSchema(),
      },
    },
  })
}

export function describeDataQueryCallQuerySchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    required: ['kind'],
    properties: {
      kind: { type: 'string', enum: DATA_QUERY_KINDS },
      spec: { type: 'object' },
    },
  })
}

export function describeDataRecordSchema() {
  return cloneValue({
    type: 'object',
  })
}

export function describeDataSummaryRowSchema() {
  return cloneValue({
    type: 'object',
  })
}

export function describeDataGroupComparisonSchema() {
  return cloneValue({
    type: ['object', 'null'],
  })
}

export function describeDataSchemaResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      fields: { type: 'array', items: describeDataFieldSchema() },
    },
  })
}

export function describeDataRowsResultSchema() {
  return cloneValue({
    type: 'array',
    items: describeDataRecordSchema(),
  })
}

export function describeDataSummaryTableSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      rows: { type: 'array', items: describeDataSummaryRowSchema() },
    },
  })
}

export function describeDataGroupComparisonResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      groupField: { type: ['string', 'null'] },
      valueField: { type: ['string', 'null'] },
      groups: { type: 'array', items: describeDataSummaryRowSchema() },
      comparison: describeDataGroupComparisonSchema(),
    },
  })
}

export const DATA_QUERY_DESCRIPTOR_TEMPLATES = {
  schema: {
    title: 'Inspect data schema',
    description: 'Read the exposed field schema for the materialized data view.',
    resultKind: 'schema',
    examples: [
      { spec: {} },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
        },
      },
    ],
  },
  sampleRows: {
    title: 'Sample visible rows',
    description: 'Read a bounded sample of rows from the shared current view or another materialized data view, optionally scoped to an active selection.',
    resultKind: 'rowSample',
    examples: [
      { spec: { limit: 10 } },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          limit: 10,
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          limit: 10,
        },
      },
    ],
  },
  filter: {
    title: 'Filter current data view',
    description: 'Run a predicate filter over the shared current view or another materialized data view, optionally after scoping to an active selection, without mutating workspace state.',
    resultKind: 'filteredRows',
    examples: [
      {
        spec: {
          predicates: [{ field: 'Region', op: 'in', value: ['North', 'West'] }],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          predicates: [{ field: 'Region', op: 'in', value: ['North', 'West'] }],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          predicates: [{ field: 'Region', op: 'in', value: ['North', 'West'] }],
        },
      },
    ],
  },
  aggregate: {
    title: 'Aggregate current data view',
    description: 'Aggregate the shared current view or another materialized data view, optionally scoped to an active selection, using group-by keys and measures.',
    resultKind: 'aggregateTable',
    examples: [
      {
        spec: {
          groupBy: ['Region'],
          measures: [{ op: 'count', as: 'recordCount' }],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          groupBy: ['Region'],
          measures: [{ op: 'count', as: 'recordCount' }],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          groupBy: ['Region'],
          measures: [{ op: 'count', as: 'recordCount' }],
        },
      },
    ],
  },
  groupBy: {
    title: 'Group current data view',
    description: 'Group rows and compute summary measures over the shared current view or another materialized data view, optionally scoped to an active selection.',
    resultKind: 'groupedTable',
    examples: [
      {
        spec: {
          groupBy: ['Region'],
          measures: [{ op: 'count', as: 'recordCount' }],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          groupBy: ['Region'],
          measures: [{ op: 'count', as: 'recordCount' }],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          groupBy: ['Region'],
          measures: [{ op: 'count', as: 'recordCount' }],
        },
      },
    ],
  },
  sql: {
    title: 'Execute data-view SQL',
    description: 'Run a SQL-like query supported by the underlying data engine over the current view or a scoped active selection.',
    resultKind: 'queryTable',
    examples: [
      { spec: { sql: 'select Region, count(*) as recordCount from data group by Region' } },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          sql: 'select Region, count(*) as recordCount from data group by Region',
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          sql: 'select Region, count(*) as recordCount from data group by Region',
        },
      },
    ],
  },
  summary: {
    title: 'Summarize current data view',
    description: 'Compute a compact summary over the shared current view, another materialized data view, or a scoped active selection.',
    resultKind: 'summaryTable',
    examples: [
      { spec: { fields: ['LatencyMs'], metrics: ['min', 'max', 'mean'] } },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          fields: ['LatencyMs'],
          metrics: ['mean'],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          fields: ['LatencyMs'],
          metrics: ['mean'],
        },
      },
    ],
  },
  computeCorrelation: {
    title: 'Compute correlation',
    description: 'Compute correlation statistics between two quantitative fields over the shared current view, another materialized data view, or a scoped active selection.',
    resultKind: 'correlationStats',
    examples: [
      { spec: { xField: 'LatencyMs', yField: 'ErrorRate' } },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          xField: 'LatencyMs',
          yField: 'ErrorRate',
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          xField: 'LatencyMs',
          yField: 'ErrorRate',
        },
      },
    ],
  },
  findExtremes: {
    title: 'Find extremes',
    description: 'Find records with the minimum, maximum, or both extremes for a field over the shared current view, another materialized data view, or a scoped active selection.',
    resultKind: 'extremeRows',
    examples: [
      { spec: { field: 'Traffic', direction: 'max', limit: 5 } },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          field: 'Traffic',
          direction: 'max',
          limit: 5,
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          field: 'Traffic',
          direction: 'max',
          limit: 5,
        },
      },
    ],
  },
  findOutliers: {
    title: 'Find outliers',
    description: 'Find records that are statistically outlying for a field over the shared current view, another materialized data view, or a scoped active selection.',
    resultKind: 'outlierRows',
    examples: [
      { spec: { field: 'ErrorRate', method: 'iqr', limit: 10 } },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          field: 'ErrorRate',
          method: 'iqr',
          limit: 10,
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          field: 'ErrorRate',
          method: 'iqr',
          limit: 10,
        },
      },
    ],
  },
  compareGroups: {
    title: 'Compare groups',
    description: 'Compare two groups over a quantitative value field in the shared current view, another materialized data view, or a scoped active selection.',
    resultKind: 'groupComparison',
    examples: [
      {
        spec: {
          groupField: 'Region',
          valueField: 'LatencyMs',
          groups: ['North', 'South'],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_view',
          },
          groupField: 'Region',
          valueField: 'LatencyMs',
          groups: ['North', 'South'],
        },
      },
      {
        spec: {
          queryScope: {
            dataRef: 'wl://demo/workspace/main/data/current_selection',
            selectionRef: 'wl://demo/workspace/main/widget/scatter/selection/brush',
          },
          groupField: 'Region',
          valueField: 'LatencyMs',
          groups: ['North', 'South'],
        },
      },
    ],
  },
}

export const DATA_QUERY_RESULT_SCHEMAS = {
  schema: describeDataSchemaResultSchema(),
  sampleRows: describeDataRowsResultSchema(),
  filter: {
    type: 'object',
    properties: {
      rows: describeDataRowsResultSchema(),
      rowCount: { type: 'integer' },
      predicates: {
        type: 'array',
        items: describeDataQueryPredicateSchema(),
      },
    },
  },
  aggregate: describeDataSummaryTableSchema(),
  groupBy: describeDataSummaryTableSchema(),
  sql: describeDataRowsResultSchema(),
  summary: describeDataSummaryTableSchema(),
  computeCorrelation: {
    type: 'object',
    properties: {
      xField: { type: 'string' },
      yField: { type: 'string' },
      correlation: { type: ['number', 'null'] },
      sampleSize: { type: 'integer' },
    },
  },
  findExtremes: describeDataSummaryTableSchema(),
  findOutliers: describeDataSummaryTableSchema(),
  compareGroups: describeDataGroupComparisonResultSchema(),
}

export const DATA_QUERY_SCHEMAS = {
  schema: withOptionalScopedDataTarget({
    type: 'object',
    additionalProperties: false,
    properties: {},
  }),
  sampleRows: withOptionalScopedDataTarget({
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 500 },
    },
  }),
  filter: withOptionalScopedDataTarget({
    type: 'object',
    additionalProperties: false,
    properties: {
      predicates: {
        type: 'array',
        minItems: 1,
        items: describeDataQueryPredicateSchema(),
      },
    },
    required: ['predicates'],
  }),
  aggregate: withOptionalScopedDataTarget(describeDataQueryAggregateSpecSchema()),
  groupBy: withOptionalScopedDataTarget(describeDataQueryAggregateSpecSchema()),
  sql: withOptionalScopedDataTarget(describeDataQuerySqlSpecSchema()),
  summary: withOptionalScopedDataTarget(describeDataQuerySummarySpecSchema()),
  computeCorrelation: withOptionalScopedDataTarget(describeDataQueryCorrelationSpecSchema()),
  findExtremes: withOptionalScopedDataTarget(describeDataQueryExtremesSpecSchema()),
  findOutliers: withOptionalScopedDataTarget(describeDataQueryOutliersSpecSchema()),
  compareGroups: withOptionalScopedDataTarget(describeDataQueryCompareGroupsSpecSchema()),
}

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

export function describeDataFieldSchema() {
  return cloneValue({
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      nullable: { type: 'boolean' },
      description: { type: 'string' },
    },
  })
}

export function describeDataQueryDescriptorSchema() {
  return cloneValue({
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
  })
}

export function describeDataHandleSchema() {
  return cloneValue({
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
        ...describeDataSchemaResultSchema(),
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
      supportedQueryDescriptors: { type: 'array', items: describeDataQueryDescriptorSchema() },
    },
  })
}

export function describeDataQueryCallSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    required: ['query'],
    properties: {
      callId: { type: 'string' },
      actor: describeRuntimeActorSchema(),
      dataRef: { type: 'string' },
      query: describeDataQueryCallQuerySchema(),
    },
  })
}

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
    description: 'Find records with the minimum or maximum extreme for a field over the shared current view, another materialized data view, or a scoped active selection.',
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

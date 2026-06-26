import { makeActionDescriptor, makeFilterEffect, makeSelectionEffect } from '../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../../adapters/widgets/shared/selectionResult.js'

function replaceTaggedTransform(transforms, tag, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => transform?._widgetvaTag !== tag)
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function replaceTaggedLayer(layers, tag, nextLayer) {
  const safeLayers = Array.isArray(layers) ? layers : []
  const nextLayers = safeLayers.filter((layer) => layer?._widgetvaTag !== tag)
  return nextLayer ? [...nextLayers, nextLayer] : nextLayers
}

function inferLineRootEncoding(spec) {
  return spec?.layer?.[0]?.encoding || spec?.encoding || {}
}

function inferRawTimeField(spec, rootEncoding, originalTransforms) {
  const taggedTimeUnit = (Array.isArray(originalTransforms) ? originalTransforms : []).find(
    (transform) => transform && typeof transform === 'object' && 'timeUnit' in transform && typeof transform.field === 'string',
  )
  if (taggedTimeUnit?.field) {
    return taggedTimeUnit.field
  }

  const xField = rootEncoding?.x?.field
  if (typeof xField !== 'string' || xField.length === 0) {
    return null
  }
  if (!xField.includes('_')) {
    return xField
  }

  const candidate = xField.split('_').at(-1)
  const rows = spec?.data?.values
  if (Array.isArray(rows) && rows.length > 0 && candidate && Object.prototype.hasOwnProperty.call(rows[0], candidate)) {
    return candidate
  }
  return xField
}

function inferRawValueField(spec, rootEncoding, originalTransforms) {
  const aggregateTransform = (Array.isArray(originalTransforms) ? originalTransforms : []).find(
    (transform) => transform && typeof transform === 'object' && Array.isArray(transform.aggregate) && transform.aggregate.length > 0,
  )
  if (aggregateTransform?.aggregate?.[0]?.field) {
    return aggregateTransform.aggregate[0].field
  }

  const yField = rootEncoding?.y?.field
  if (typeof yField !== 'string' || yField.length === 0) {
    return null
  }
  if (yField.startsWith('total_')) {
    return yField.slice('total_'.length)
  }
  if (yField.startsWith('sum_')) {
    return yField.slice('sum_'.length)
  }
  return yField
}

function detectTemporalAxis(encoding, timeField) {
  if (encoding?.x?.field === timeField || encoding?.x?.type === 'temporal') {
    return { timeAxis: 'x', valueAxis: 'y' }
  }
  return { timeAxis: 'y', valueAxis: 'x' }
}

export function buildLineActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['line']
  return [
    makeActionDescriptor({
      name: 'line.selectSeries',
      title: 'Select line series',
      description: 'Select one or more categorical series represented in the line chart.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          values: { type: 'array', items: { type: 'string' } },
        },
        required: ['field', 'values'],
      },
      postconditions: [
        {
          description: 'The active selection should contain the selected series values.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.selectSeries requires a valid line target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a categorical selection over line series.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may be filtered by the selected line series.')),
      ],
      examples: [
        {
          userGoal: 'Focus one or more line series before comparing trends.',
          params: { field: 'Origin', values: ['Japan'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.selectXValue',
      title: 'Select a line x-axis value',
      description: 'Select all visible line rows that share one x-axis value, such as one year or one named category bucket.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          value: {
            anyOf: [{ type: 'string' }, { type: 'number' }],
          },
          field: { type: 'string' },
        },
        required: ['value'],
      },
      postconditions: [
        {
          description: 'The active selection should contain one predicate targeting the chosen x-axis value.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.selectXValue requires a valid line target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a selection over one x-axis value in the current line view.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may update to the selected line x-axis slice.')),
      ],
      examples: [
        {
          userGoal: 'Select one model year across the line view before checking linked distributions and details.',
          params: { field: 'year', value: 1971 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.zoomXRegion',
      title: 'Zoom line chart x-region',
      description: 'Zoom the temporal x-axis of the line chart to a specific start/end range without discarding data.',
      primitive: 'zoom',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' },
        },
        required: ['start', 'end'],
      },
      postconditions: [
        {
          description: 'The line chart x-axis domain should reflect the requested start/end range.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.zoomXRegion requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Zoom into a particular date range to inspect the detailed trend.',
          params: { start: '2024-01-01', end: '2024-02-01' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.focusLines',
      title: 'Focus line series',
      description: 'Emphasize one or more line series while dimming the remaining lines.',
      primitive: 'focus',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          lines: { type: 'array', items: { type: 'string' } },
          lineField: { type: 'string' },
          dimOpacity: { type: 'number' },
        },
        required: ['lines'],
      },
      postconditions: [
        {
          description: 'The requested line series should be visually emphasized while the remaining lines are dimmed.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.focusLines requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Focus a subset of line series before comparing their trends.',
          params: { lines: ['A'], lineField: 'series', dimOpacity: 0.08 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.highlightTrend',
      title: 'Highlight line trend',
      description: 'Add or refresh a regression trend line layer over the existing line chart.',
      primitive: 'annotate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          trendType: { type: 'string' },
        },
      },
      postconditions: [
        {
          description: 'The line chart should include a visible regression trend line layer over the current x/y encoding.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.highlightTrend requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Add a regression overlay before describing the overall trend direction.',
          params: { trendType: 'increasing' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.showMovingAverage',
      title: 'Overlay moving average',
      description: 'Add or replace a moving-average overlay line computed from the current temporal/value encodings, optionally grouped by line series.',
      primitive: 'annotate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          windowSize: { type: 'number' },
        },
      },
      postconditions: [
        {
          description: 'A tagged moving-average overlay layer should be present and should use a Vega window transform over the current line encodings.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.showMovingAverage requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Smooth a noisy line chart with a 3-period trailing moving average.',
          params: { windowSize: 3 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.drillDownXAxis',
      title: 'Drill down line x-axis',
      description: 'Drill a temporal line chart from a coarser time aggregation into a more detailed x-axis view.',
      primitive: 'drillDown',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          level: { type: 'string' },
          value: { type: 'number' },
          parent: { type: 'object' },
        },
        required: ['level', 'value'],
      },
      postconditions: [
        {
          description: 'The line chart should switch to a finer temporal aggregation with matching filters and updated x/y encodings.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.drillDownXAxis requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Drill a yearly trend into monthly detail for a specific year.',
          params: { level: 'year', value: 2024 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.resetDrilldownXAxis',
      title: 'Reset line x-axis drill-down',
      description: 'Restore the original line chart encoding, transforms, and title after a temporal drill-down.',
      primitive: 'navigate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
        },
      },
      postconditions: [
        {
          description: 'The line chart should revert to its original temporal encoding, transforms, and title.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.resetDrilldownXAxis requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Return from a drilled monthly view back to the original yearly chart.',
          params: {},
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.resampleXAxis',
      title: 'Resample line x-axis',
      description: 'Change the temporal aggregation granularity of a line chart and apply an aggregate to the value axis.',
      primitive: 'aggregate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          granularity: { type: 'string' },
          agg: { type: 'string' },
        },
        required: ['granularity'],
      },
      postconditions: [
        {
          description: 'The line chart time axis should use the requested timeUnit and the value axis should use the requested aggregation.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.resampleXAxis requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Switch a dense daily series into monthly mean values before comparing long-term trends.',
          params: { granularity: 'month', agg: 'mean' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.resetResampleXAxis',
      title: 'Reset line x-axis resample',
      description: 'Restore the original temporal encoding after a line x-axis resampling operation.',
      primitive: 'navigate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
        },
      },
      postconditions: [
        {
          description: 'The line chart should revert to its original temporal encoding and clear the resample state.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.resetResampleXAxis requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Return a resampled monthly line chart back to its original daily granularity.',
          params: {},
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.boldLines',
      title: 'Bold line series',
      description: 'Increase the stroke width of one or more line series while keeping the remaining lines thin.',
      primitive: 'highlight',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          lineNames: { type: 'array', items: { type: 'string' } },
          lineField: { type: 'string' },
          boldWidth: { type: 'number' },
          baseWidth: { type: 'number' },
        },
        required: ['lineNames'],
      },
      postconditions: [
        {
          description: 'The requested line series should be rendered with a thicker stroke than the remaining lines.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.boldLines requires a valid line target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Make one or more line series stand out before comparing the trends.',
          params: { lineNames: ['A'], lineField: 'series', boldWidth: 4, baseWidth: 1 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'line.filterLines',
      title: 'Filter out line series',
      description: 'Exclude one or more line series from the current chart by writing a series filter into the line spec.',
      primitive: 'filter',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          linesToRemove: { type: 'array', items: { type: 'string' } },
          lineField: { type: 'string' },
        },
        required: ['linesToRemove'],
      },
      postconditions: [
        {
          description: 'The line chart transform list should exclude the requested line series.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid line widget in the current workspace.',
          failureMessage: 'line.filterLines requires a valid line target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeFilterEffect(ref, ref === widgetRef
          ? 'The requested line series are excluded from the current chart.'
          : 'Linked widgets may update to reflect the removed line series.')),
      examples: [
        {
          userGoal: 'Remove noisy or irrelevant series before comparing the remaining trends.',
          params: { linesToRemove: ['B'], lineField: 'series' },
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerLineActions(actionExecutor) {
  if (!actionExecutor.has('line.selectSeries')) {
    actionExecutor.register(
      { name: 'line.selectSeries' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
        })
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === 'string') : []
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('line.selectSeries requires a line target, field, and one or more values.')
        }

        const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length
        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field,
          values,
          predicates: [{ field, op: 'in', value: values }],
          count: matchedCount,
          summary: `${field}: ${values.join(', ')}`,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated line selection state.',
            'Read linked widgets to confirm series-level filter propagation.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('line.zoomXRegion')) {
    actionExecutor.register(
      { name: 'line.zoomXRegion' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.zoomXRegion requires a valid line target widget.',
        })
        const start = typeof params.start === 'string' ? params.start : null
        const end = typeof params.end === 'string' ? params.end : null
        if (!targetWidget || !start || !end) {
          throw new Error('line.zoomXRegion requires a line target plus start and end values.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line x-domain updates.')
          }

          const nextEncoding = { ...(spec.encoding || {}) }
          if (!nextEncoding.x) {
            throw new Error('line.zoomXRegion requires an x encoding on the active line spec.')
          }
          nextEncoding.x = {
            ...nextEncoding.x,
            scale: {
              ...(nextEncoding.x.scale || {}),
              domain: [start, end],
            },
          }

          const nextMark = typeof spec.mark === 'string'
            ? { type: spec.mark, clip: true }
            : {
                ...(spec.mark || {}),
                clip: true,
              }

          return {
            ...spec,
            mark: nextMark,
            encoding: nextEncoding,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            xDomain: [start, end],
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart x-domain was updated.',
            'Read the target widget view state to confirm the new temporal x-domain values.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.selectXValue')) {
    actionExecutor.register(
      { name: 'line.selectXValue' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.selectXValue requires a valid line target widget.',
        })
        const rawValue = params.value
        const explicitField = typeof params.field === 'string' && params.field.length > 0 ? params.field : null
        if (!targetWidget || rawValue == null) {
          throw new Error('line.selectXValue requires a line target and a non-null x-axis value.')
        }

        const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
        const currentSpec = ctx.readCurrentSpec?.()
          || targetWidget.readState?.().currentSpec
          || targetWidget.readState?.().rawSpec
          || null
        const rootEncoding = currentSpec?.layer?.[0]?.encoding || currentSpec?.encoding || {}
        const field = explicitField || rootEncoding?.x?.field || null
        if (!field) {
          throw new Error('line.selectXValue requires a resolvable x-axis field on the active line spec.')
        }

        const matchedCount = visibleRows.filter((row) => row?.[field] === rawValue).length
        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field,
          values: [rawValue],
          predicates: [{ field, op: 'in', value: [rawValue] }],
          count: matchedCount,
          summary: `${field}: ${rawValue}`,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated line selection state.',
            'Read linked widgets to confirm the selected x-axis slice propagated beyond the line chart.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('line.focusLines')) {
    actionExecutor.register(
      { name: 'line.focusLines' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.focusLines requires a valid line target widget.',
        })
        const lines = Array.isArray(params.lines) ? params.lines.filter((value) => typeof value === 'string' && value.length > 0) : []
        const dimOpacity = typeof params.dimOpacity === 'number' ? params.dimOpacity : 0.08
        if (!targetWidget || lines.length === 0) {
          throw new Error('line.focusLines requires a line target and at least one line identifier.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line focus updates.')
          }

          const encoding = spec.encoding || {}
          const lineField = typeof params.lineField === 'string'
            ? params.lineField
            : encoding?.color?.field || encoding?.detail?.field || null
          if (!lineField) {
            throw new Error('line.focusLines requires a lineField or an existing color/detail grouping field on the active line spec.')
          }

          const linesJson = JSON.stringify(lines)
          return {
            ...spec,
            encoding: {
              ...encoding,
              opacity: {
                condition: {
                  test: `indexof(${linesJson}, datum['${lineField}']) >= 0`,
                  value: 1.0,
                },
                value: dimOpacity,
              },
            },
            _line_focus_state: {
              lines,
              line_field: lineField,
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            lines,
            lineField: params.lineField || null,
            dimOpacity,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart opacity condition now focuses the requested series.',
            'Read the target widget view state to confirm non-focused lines are dimmed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.highlightTrend')) {
    actionExecutor.register(
      { name: 'line.highlightTrend' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.highlightTrend requires a valid line target widget.',
        })
        const trendType = typeof params.trendType === 'string' && params.trendType.length > 0
          ? params.trendType
          : 'increasing'
        if (!targetWidget) {
          throw new Error('line.highlightTrend requires a valid line target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line trend highlighting.')
          }

          const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {}
          const xField = rootEncoding?.x?.field || null
          const yField = rootEncoding?.y?.field || null
          const xType = rootEncoding?.x?.type || 'temporal'
          const yType = rootEncoding?.y?.type || 'quantitative'
          if (!xField || !yField) {
            throw new Error('line.highlightTrend requires x and y encodings on the active line spec.')
          }

          const trendLayer = {
            _widgetvaTag: 'line.highlightTrend',
            mark: {
              type: 'line',
              color: 'red',
              strokeDash: [5, 5],
              strokeWidth: 2,
            },
            transform: [{
              regression: yField,
              on: xField,
            }],
            encoding: {
              x: { field: xField, type: xType },
              y: { field: yField, type: yType },
            },
          }

          if (Array.isArray(spec.layer) && spec.layer.length > 0) {
            return {
              ...spec,
              layer: replaceTaggedLayer(spec.layer, 'line.highlightTrend', trendLayer),
            }
          }

          const nextSpec = { ...spec }
          const baseLayer = {
            mark: spec.mark || 'line',
            encoding: spec.encoding || {},
          }
          delete nextSpec.mark
          delete nextSpec.encoding
          return {
            ...nextSpec,
            layer: replaceTaggedLayer([baseLayer], 'line.highlightTrend', trendLayer),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            trendType,
            overlay: 'regression',
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify a regression trend layer was added to the line chart.',
            'Read the target widget view state to confirm the trend overlay uses the current x/y encoding fields.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.showMovingAverage')) {
    actionExecutor.register(
      { name: 'line.showMovingAverage' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.showMovingAverage requires a valid line target widget.',
        })
        const windowSize = Number.isFinite(params.windowSize) ? Math.floor(Number(params.windowSize)) : 3
        if (!targetWidget || windowSize < 1) {
          throw new Error('line.showMovingAverage requires a valid line target widget and a windowSize >= 1.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line moving-average overlays.')
          }

          const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {}
          const xField = rootEncoding?.x?.field || null
          const yField = rootEncoding?.y?.field || null
          const xType = rootEncoding?.x?.type || 'temporal'
          if (!xField || !yField) {
            throw new Error('line.showMovingAverage requires x and y encodings on the active line spec.')
          }

          const colorEncoding = rootEncoding?.color && typeof rootEncoding.color === 'object'
            ? structuredClone(rootEncoding.color)
            : null
          const detailEncoding = rootEncoding?.detail && typeof rootEncoding.detail === 'object'
            ? structuredClone(rootEncoding.detail)
            : null
          const groupField = colorEncoding?.field || detailEncoding?.field || null
          const maField = `${yField}_ma`

          const maLayer = {
            _widgetvaTag: 'line.showMovingAverage',
            mark: {
              type: 'line',
              color: 'orange',
              strokeWidth: 3,
              opacity: 0.8,
            },
            transform: [{
              window: [{
                op: 'mean',
                field: yField,
                as: maField,
              }],
              frame: [-(windowSize - 1), 0],
              sort: [{ field: xField, order: 'ascending' }],
              ...(groupField ? { groupby: [groupField] } : {}),
            }],
            encoding: {
              x: { field: xField, type: xType },
              y: { field: maField, type: 'quantitative' },
              ...(colorEncoding ? { color: colorEncoding } : {}),
              ...(!colorEncoding && detailEncoding ? { detail: detailEncoding } : {}),
            },
          }

          if (Array.isArray(spec.layer) && spec.layer.length > 0) {
            return {
              ...spec,
              layer: replaceTaggedLayer(spec.layer, 'line.showMovingAverage', maLayer),
            }
          }

          const nextSpec = { ...spec }
          const baseLayer = {
            mark: spec.mark || 'line',
            encoding: spec.encoding || {},
          }
          delete nextSpec.mark
          delete nextSpec.encoding
          return {
            ...nextSpec,
            layer: replaceTaggedLayer([baseLayer], 'line.showMovingAverage', maLayer),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            windowSize,
            overlay: 'movingAverage',
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify a tagged moving-average overlay layer was added to the line chart.',
            'Read the target widget view state to confirm the overlay uses a window transform sorted by the current temporal axis.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.drillDownXAxis')) {
    actionExecutor.register(
      { name: 'line.drillDownXAxis' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.drillDownXAxis requires a valid line target widget.',
        })
        const level = typeof params.level === 'string' ? params.level.toLowerCase().trim() : null
        const numericValue = Number.isFinite(params.value) ? Number(params.value) : null
        const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
          ? params.parent
          : {}
        if (!targetWidget || !level || numericValue === null) {
          throw new Error('line.drillDownXAxis requires a line target plus level and numeric value.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line x-axis drill-down.')
          }

          const drillState = spec._line_drilldown_state && typeof spec._line_drilldown_state === 'object'
            ? { ...spec._line_drilldown_state }
            : {}

          if (!drillState.original_transform) {
            drillState.original_transform = Array.isArray(spec.transform) ? structuredClone(spec.transform) : []
            drillState.original_encoding = structuredClone(spec.encoding || {})
            drillState.original_title = spec.title || ''

            const rootEncoding = inferLineRootEncoding(spec)
            drillState.raw_time_field = inferRawTimeField(spec, rootEncoding, drillState.original_transform)
            drillState.raw_value_field = inferRawValueField(spec, rootEncoding, drillState.original_transform)
            drillState.group_field = rootEncoding?.color?.field || null
          }

          const rawDateField = drillState.raw_time_field
          const rawValueField = drillState.raw_value_field
          const groupField = drillState.group_field
          if (!rawDateField || !rawValueField) {
            throw new Error('line.drillDownXAxis requires x/y fields that can be resolved to raw date/value columns.')
          }

          const nextTransforms = []
          let nextEncoding
          let nextParent = {}
          let titleSuffix = ''

          if (level === 'year') {
            nextTransforms.push({
              filter: `year(datum.${rawDateField}) == ${numericValue}`,
              _widgetvaTag: 'line.drillDownXAxis',
            })
            nextTransforms.push({
              timeUnit: 'yearmonth',
              field: rawDateField,
              as: 'month_date',
              _widgetvaTag: 'line.drillDownXAxis',
            })
            nextTransforms.push({
              aggregate: [{ op: 'sum', field: rawValueField, as: 'total_value' }],
              groupby: groupField ? ['month_date', groupField] : ['month_date'],
              _widgetvaTag: 'line.drillDownXAxis',
            })
            nextParent = { year: numericValue }
            titleSuffix = `${numericValue} monthly trend`
            nextEncoding = {
              x: {
                field: 'month_date',
                type: 'temporal',
                title: 'Month',
                axis: { format: '%Y-%m' },
              },
              y: {
                field: 'total_value',
                type: 'quantitative',
                title: `Monthly total ${rawValueField}`,
              },
              ...(groupField ? { color: drillState.original_encoding?.color || { field: groupField, type: 'nominal' } } : {}),
            }
          } else if (level === 'month') {
            const yearValue = Number.isFinite(parent.year) ? Number(parent.year) : null
            if (yearValue === null) {
              throw new Error('line.drillDownXAxis month drill-down requires parent.year.')
            }
            if (numericValue < 1 || numericValue > 12) {
              throw new Error('line.drillDownXAxis month drill-down requires a month value between 1 and 12.')
            }
            nextTransforms.push({
              filter: `year(datum.${rawDateField}) == ${yearValue} && month(datum.${rawDateField}) == ${numericValue - 1}`,
              _widgetvaTag: 'line.drillDownXAxis',
            })
            nextTransforms.push({
              timeUnit: 'yearmonthdate',
              field: rawDateField,
              as: 'day_date',
              _widgetvaTag: 'line.drillDownXAxis',
            })
            nextTransforms.push({
              aggregate: [{ op: 'sum', field: rawValueField, as: 'total_value' }],
              groupby: groupField ? ['day_date', groupField] : ['day_date'],
              _widgetvaTag: 'line.drillDownXAxis',
            })
            nextParent = { year: yearValue, month: numericValue }
            titleSuffix = `${yearValue}-${String(numericValue).padStart(2, '0')} daily trend`
            nextEncoding = {
              x: {
                field: 'day_date',
                type: 'temporal',
                title: 'Date',
                axis: { format: '%m-%d' },
              },
              y: {
                field: 'total_value',
                type: 'quantitative',
                title: `Daily total ${rawValueField}`,
              },
              ...(groupField ? { color: drillState.original_encoding?.color || { field: groupField, type: 'nominal' } } : {}),
            }
          } else {
            throw new Error(`line.drillDownXAxis does not support level "${level}".`)
          }

          drillState.parent = nextParent

          return {
            ...spec,
            transform: nextTransforms,
            encoding: nextEncoding,
            title: titleSuffix,
            _line_drilldown_state: drillState,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            level,
            value: numericValue,
            parent,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart transform and x encoding now reflect the finer temporal drill-down.',
            'Read the target widget rows to confirm the line chart is now scoped to the drilled period.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.resetDrilldownXAxis')) {
    actionExecutor.register(
      { name: 'line.resetDrilldownXAxis' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.resetDrilldownXAxis requires a valid line target widget.',
        })
        if (!targetWidget) {
          throw new Error('line.resetDrilldownXAxis requires a valid line target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line drill-down reset.')
          }

          const drillState = spec._line_drilldown_state
          if (!drillState || typeof drillState !== 'object') {
            return spec
          }

          const nextSpec = { ...spec }
          if (Object.prototype.hasOwnProperty.call(drillState, 'original_transform')) {
            nextSpec.transform = Array.isArray(drillState.original_transform)
              ? structuredClone(drillState.original_transform)
              : []
          } else if (Array.isArray(nextSpec.transform)) {
            nextSpec.transform = nextSpec.transform.filter((transform) => transform?._widgetvaTag !== 'line.drillDownXAxis')
          }

          if (drillState.original_encoding && typeof drillState.original_encoding === 'object') {
            nextSpec.encoding = structuredClone(drillState.original_encoding)
          }

          if (Object.prototype.hasOwnProperty.call(drillState, 'original_title')) {
            nextSpec.title = drillState.original_title
          }

          delete nextSpec._line_drilldown_state
          nextSpec._navigation_state = {
            mode: 'reset',
            sourceAction: 'line.resetDrilldownXAxis',
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            reset: true,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the original line x/y encoding and transforms were restored.',
            'Read the target widget view state to confirm the drill-down state marker has been removed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.resampleXAxis')) {
    actionExecutor.register(
      { name: 'line.resampleXAxis' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.resampleXAxis requires a valid line target widget.',
        })
        const granularity = typeof params.granularity === 'string' ? params.granularity.toLowerCase().trim() : null
        const agg = typeof params.agg === 'string' ? params.agg.toLowerCase().trim() : 'mean'
        const granularityMap = {
          day: 'yearmonthdate',
          week: 'yearweek',
          month: 'yearmonth',
          quarter: 'yearquarter',
          year: 'year',
        }
        const allowedAgg = new Set(['mean', 'sum', 'max', 'min', 'median', 'count'])
        if (!targetWidget || !granularity || !granularityMap[granularity]) {
          throw new Error('line.resampleXAxis requires a line target and a supported granularity: day, week, month, quarter, or year.')
        }
        if (!allowedAgg.has(agg)) {
          throw new Error('line.resampleXAxis requires a supported aggregation: mean, sum, max, min, median, or count.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line x-axis resampling.')
          }

          const nextSpec = { ...spec }
          const resampleState = nextSpec._resample_state && typeof nextSpec._resample_state === 'object'
            ? { ...nextSpec._resample_state }
            : {}

          const rootEncoding = inferLineRootEncoding(nextSpec)
          const timeField = inferRawTimeField(nextSpec, rootEncoding, nextSpec.transform)
          if (!timeField) {
            throw new Error('line.resampleXAxis requires a temporal field in the active line spec.')
          }

          if (!resampleState.original_encoding) {
            resampleState.original_encoding = structuredClone(rootEncoding)
          }

          const applyEncodingUpdate = (encoding) => {
            const nextEncoding = structuredClone(encoding || {})
            const { timeAxis, valueAxis } = detectTemporalAxis(nextEncoding, timeField)
            if (!nextEncoding[timeAxis]) {
              throw new Error('line.resampleXAxis requires a temporal axis encoding in the active line spec.')
            }
            nextEncoding[timeAxis] = {
              ...nextEncoding[timeAxis],
              timeUnit: granularityMap[granularity],
              type: 'temporal',
            }
            if (nextEncoding[valueAxis]?.field) {
              nextEncoding[valueAxis] = {
                ...nextEncoding[valueAxis],
                aggregate: agg,
              }
            }
            return nextEncoding
          }

          if (Array.isArray(nextSpec.layer) && nextSpec.layer.length > 0) {
            nextSpec.layer = nextSpec.layer.map((layer, index) => {
              if (!layer?.encoding) {
                return layer
              }
              if (index === 0 && !resampleState.original_encoding) {
                resampleState.original_encoding = structuredClone(layer.encoding)
              }
              return {
                ...layer,
                encoding: applyEncodingUpdate(layer.encoding),
              }
            })
          } else {
            nextSpec.encoding = applyEncodingUpdate(nextSpec.encoding || {})
          }

          resampleState.current_granularity = granularity
          resampleState.current_agg = agg
          nextSpec._resample_state = resampleState
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            granularity,
            agg,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart time axis now uses the requested timeUnit.',
            'Read the target widget view state to confirm the value axis now carries the requested aggregation.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.resetResampleXAxis')) {
    actionExecutor.register(
      { name: 'line.resetResampleXAxis' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.resetResampleXAxis requires a valid line target widget.',
        })
        if (!targetWidget) {
          throw new Error('line.resetResampleXAxis requires a valid line target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line resample reset.')
          }

          const resampleState = spec._resample_state
          if (!resampleState || typeof resampleState !== 'object') {
            return spec
          }

          const nextSpec = { ...spec }
          const originalEncoding = resampleState.original_encoding
          if (originalEncoding && typeof originalEncoding === 'object') {
            if (Array.isArray(nextSpec.layer) && nextSpec.layer.length > 0) {
              nextSpec.layer = nextSpec.layer.map((layer, index) => {
                if (index !== 0 || !layer) {
                  return layer
                }
                return {
                  ...layer,
                  encoding: structuredClone(originalEncoding),
                }
              })
            } else {
              nextSpec.encoding = structuredClone(originalEncoding)
            }
          }

          delete nextSpec._resample_state
          nextSpec._navigation_state = {
            mode: 'reset',
            sourceAction: 'line.resetResampleXAxis',
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            reset: true,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the original line temporal encoding was restored.',
            'Read the target widget view state to confirm the resample state marker has been removed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.boldLines')) {
    actionExecutor.register(
      { name: 'line.boldLines' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.boldLines requires a valid line target widget.',
        })
        const lineNames = Array.isArray(params.lineNames)
          ? params.lineNames.filter((value) => typeof value === 'string' && value.length > 0)
          : []
        const boldWidth = typeof params.boldWidth === 'number' ? params.boldWidth : 4
        const baseWidth = typeof params.baseWidth === 'number' ? params.baseWidth : 1
        if (!targetWidget || lineNames.length === 0) {
          throw new Error('line.boldLines requires a line target and at least one line identifier.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line bolding updates.')
          }

          const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {}
          const lineField = typeof params.lineField === 'string'
            ? params.lineField
            : rootEncoding?.color?.field || rootEncoding?.detail?.field || null
          if (!lineField) {
            throw new Error('line.boldLines requires a lineField or an existing color/detail grouping field on the active line spec.')
          }

          const strokeWidth = {
            condition: {
              test: `indexof(${JSON.stringify(lineNames)}, datum['${lineField}']) >= 0`,
              value: boldWidth,
            },
            value: baseWidth,
          }

          if (Array.isArray(spec.layer) && spec.layer.length > 0) {
            return {
              ...spec,
              layer: spec.layer.map((layer) => {
                const mark = layer?.mark
                const markType = typeof mark === 'string' ? mark : mark?.type
                if (markType !== 'line') {
                  return layer
                }
                return {
                  ...layer,
                  encoding: {
                    ...(layer?.encoding || {}),
                    strokeWidth,
                  },
                }
              }),
            }
          }

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              strokeWidth,
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            lineNames,
            lineField: params.lineField || null,
            boldWidth,
            baseWidth,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart strokeWidth condition now emphasizes the requested series.',
            'Read the target widget view state to confirm the requested line series are rendered with a thicker stroke.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.filterLines')) {
    actionExecutor.register(
      { name: 'line.filterLines' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'line',
          message: 'line.filterLines requires a valid line target widget.',
        })
        const linesToRemove = Array.isArray(params.linesToRemove)
          ? params.linesToRemove.filter((value) => typeof value === 'string' && value.length > 0)
          : []
        if (!targetWidget || linesToRemove.length === 0) {
          throw new Error('line.filterLines requires a line target and one or more line names to remove.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for line series filtering.')
          }

          const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {}
          const lineField = typeof params.lineField === 'string'
            ? params.lineField
            : rootEncoding?.color?.field || rootEncoding?.detail?.field || null
          if (!lineField) {
            throw new Error('line.filterLines requires a line grouping field on the active line spec.')
          }

          return {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'line.filterLines', {
              filter: {
                field: lineField,
                notOneOf: linesToRemove,
              },
              _widgetvaTag: 'line.filterLines',
            }),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            linesToRemove,
            ...(typeof params.lineField === 'string' ? { lineField: params.lineField } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart transform now excludes the requested line series.',
            'Read the target widget rows to confirm the removed series no longer appear in the visible line data.',
          ],
        }
      },
    )
  }
}

import { makeActionDescriptor, makeFilterEffect, makeSelectionEffect } from '../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../../adapters/widgets/shared/selectionResult.js'

const MONTH_MAP = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
}

function datumRef(field) {
  return `datum['${String(field).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isPrimitiveSelectionValue(value) {
  return typeof value === 'string' || typeof value === 'number'
}

function replaceTaggedTransform(transforms, tag, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => transform?._widgetvaTag !== tag)
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function resolveHeatmapAxisFieldAlias(spec, requestedField, axis) {
  if (typeof requestedField !== 'string' || requestedField.length === 0) {
    return null
  }

  const encodingField = typeof spec?.encoding?.[axis]?.field === 'string'
    ? spec.encoding[axis].field
    : null
  if (!encodingField) {
    return requestedField
  }

  if (requestedField === axis || requestedField === encodingField) {
    return encodingField
  }

  return requestedField
}

function normalizeTimeUnitValues(field, values, timeUnit) {
  const safeValues = Array.isArray(values) ? values.filter((value) => value != null) : []
  if (!timeUnit) {
    return {
      valueListExpr: safeValues.map((value) => JSON.stringify(value)).join(','),
      datumExpr: datumRef(field),
    }
  }

  const normalizedTimeUnit = String(timeUnit).toLowerCase().trim()
  if (normalizedTimeUnit === 'date') {
    const numericValues = safeValues
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
    return {
      valueListExpr: (numericValues.length > 0 ? numericValues : safeValues).map((value) => JSON.stringify(value)).join(','),
      datumExpr: `date(${datumRef(field)})`,
    }
  }

  if (normalizedTimeUnit === 'month') {
    const monthValues = safeValues
      .map((value) => {
        if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(MONTH_MAP, value)) {
          return MONTH_MAP[value]
        }
        const parsed = Number.parseInt(value, 10)
        return Number.isFinite(parsed) ? parsed - 1 : null
      })
      .filter((value) => Number.isFinite(value))
    return {
      valueListExpr: (monthValues.length > 0 ? monthValues : safeValues).map((value) => JSON.stringify(value)).join(','),
      datumExpr: `month(${datumRef(field)})`,
    }
  }

  if (normalizedTimeUnit === 'year') {
    const numericValues = safeValues
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
    return {
      valueListExpr: (numericValues.length > 0 ? numericValues : safeValues).map((value) => JSON.stringify(value)).join(','),
      datumExpr: `year(${datumRef(field)})`,
    }
  }

  return {
    valueListExpr: safeValues.map((value) => JSON.stringify(value)).join(','),
    datumExpr: `${normalizedTimeUnit}(${datumRef(field)})`,
  }
}

export function buildHeatmapActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['heatmap']
  const filterCellDescriptor = makeActionDescriptor({
      name: 'heatmap.filterCells',
      title: 'Filter heatmap cells',
      description: 'Filter the workspace through a heatmap cell identified by its x/y category pair.',
      primitive: 'filter',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          xField: { type: 'string' },
          yField: { type: 'string' },
          xValue: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          yValue: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        },
        required: ['xField', 'yField', 'xValue', 'yValue'],
      },
      postconditions: [
        {
          description: 'The active selection should contain the selected x/y cell pair and linked widgets should be filterable from it.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.filterCells requires a valid heatmap target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a cell selection on the heatmap.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may be filtered by the selected heatmap cell.')),
      ],
      examples: [
        {
          userGoal: 'Select one heatmap cell and inspect linked detail views.',
          params: { xField: 'Origin', yField: 'Cylinders', xValue: 'Japan', yValue: '4' },
        },
      ],
      reversible: true,
    })

  const selectCellDescriptor = makeActionDescriptor({
    ...cloneValue(filterCellDescriptor),
    name: 'heatmap.selectCell',
    title: 'Select heatmap cell',
    description: 'Select a single heatmap cell through the canonical heatmap cell contract.',
    primitive: 'select',
    category: 'selection',
  })

  return [
    filterCellDescriptor,
    selectCellDescriptor,
    makeActionDescriptor({
      name: 'heatmap.selectSubmatrix',
      title: 'Select heatmap submatrix',
      description: 'Select a heatmap submatrix defined by one or more x-axis and/or y-axis coordinates without mutating the view spec.',
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
          xValues: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          },
          yValues: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          },
        },
      },
      postconditions: [
        {
          description: 'The active selection should contain the selected heatmap rows, columns, or their intersection region.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.selectSubmatrix requires a valid heatmap target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a heatmap region selection over rows, columns, or an intersection.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may be filtered by the selected heatmap submatrix.')),
      ],
      examples: [
        {
          userGoal: 'Select a rectangular region of the heatmap before inspecting linked views.',
          params: { xValues: ['Q1', 'Q2'], yValues: ['A', 'B'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.drilldownAxis',
      title: 'Drill down heatmap time axis',
      description: 'Drill a temporal heatmap x-axis from year to month or from month to date by narrowing the visible period and refining the x-axis timeUnit.',
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
          value: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          parent: { type: 'object' },
        },
        required: ['level', 'value'],
      },
      postconditions: [
        {
          description: 'The heatmap x-axis should move to a finer temporal granularity while the transform list narrows the visible period.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.drilldownAxis requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Drill a yearly heatmap into monthly detail for one year.',
          params: { level: 'year', value: 2024 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.resetDrilldown',
      title: 'Reset heatmap drill-down',
      description: 'Restore the original temporal x-axis encoding and remove drill-down filters from the heatmap.',
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
          description: 'The heatmap should revert to its original temporal x-axis encoding and remove tagged drill-down filters.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.resetDrilldown requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Return a drilled heatmap back to its original yearly overview.',
          params: {},
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.addMarginalBars',
      title: 'Add heatmap marginal bars',
      description: 'Compose a heatmap with optional top and right marginal bar charts that aggregate the heatmap value field along each axis.',
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
          op: { type: 'string' },
          showTop: { type: 'boolean' },
          showRight: { type: 'boolean' },
          barSize: { type: 'number' },
          barColor: { type: 'string' },
        },
      },
      postconditions: [
        {
          description: 'The heatmap should be composed with marginal bars that aggregate the color/value field along rows and/or columns.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.addMarginalBars requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Add row and column marginal summaries before comparing the overall heatmap structure.',
          params: { op: 'mean', showTop: true, showRight: true, barSize: 70, barColor: '#666666' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.highlightRegion',
      title: 'Highlight heatmap region',
      description: 'Highlight one or more heatmap rows, columns, or their intersection without filtering away the rest of the matrix.',
      primitive: 'highlight',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          xValues: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          yValues: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
        },
      },
      postconditions: [
        {
          description: 'The heatmap should visually emphasize the requested rows, columns, or region while dimming the rest.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.highlightRegion requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Highlight one row/column region before comparing extreme cells.',
          params: { xValues: ['Q1'], yValues: ['A'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.adjustColorScale',
      title: 'Adjust heatmap color scale',
      description: 'Update the heatmap color scheme and optional numeric domain without changing the underlying data.',
      primitive: 'reencode',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          scheme: { type: 'string' },
          domain: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }],
            },
          },
        },
      },
      postconditions: [
        {
          description: 'The heatmap color encoding should reflect the requested scheme and optional domain.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.adjustColorScale requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Switch to a new color scheme and tighten the value range for comparison.',
          params: { scheme: 'blues', domain: [0, 25] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.thresholdMask',
      title: 'Mask heatmap values outside a threshold range',
      description: 'Visually dim heatmap cells whose color values fall outside the requested inclusive threshold range.',
      primitive: 'highlight',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          minValue: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          maxValue: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          outsideOpacity: { type: 'number' },
        },
        required: ['minValue', 'maxValue'],
      },
      postconditions: [
        {
          description: 'The heatmap opacity encoding should preserve cells inside the threshold range and dim cells outside it.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.thresholdMask requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Dim low-signal cells while keeping the full matrix visible.',
          params: { minValue: 10, maxValue: 25, outsideOpacity: 0.1 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.filterCellsByRegion',
      title: 'Filter heatmap cells by region',
      description: 'Exclude one or more heatmap rows, columns, or their intersection by writing a region filter into the heatmap spec.',
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
          xValue: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          yValue: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          xValues: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          },
          yValues: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          },
        },
      },
      postconditions: [
        {
          description: 'The heatmap transform list should exclude the requested rows, columns, or intersection region.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.filterCellsByRegion requires a valid heatmap target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeFilterEffect(ref, ref === widgetRef
          ? 'The heatmap excludes the requested rows, columns, or intersection region.'
          : 'Linked widgets may update to reflect the excluded heatmap region.')),
      examples: [
        {
          userGoal: 'Remove one heatmap row-column intersection before inspecting the remaining structure.',
          params: { xValues: ['Q1'], yValues: ['A'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.highlightRegionByValue',
      title: 'Highlight heatmap cells by value range',
      description: 'Visually emphasize cells whose displayed values fall inside a requested range, while dimming the rest without filtering data away.',
      primitive: 'highlight',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          minValue: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          maxValue: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          outsideOpacity: { type: 'number' },
        },
      },
      postconditions: [
        {
          description: 'The heatmap opacity encoding should emphasize values inside the requested range and dim values outside it.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.highlightRegionByValue requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Highlight only mid-range or high-value cells before comparing hotspots.',
          params: { minValue: 10, maxValue: 25, outsideOpacity: 0.12 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.clusterRowsCols',
      title: 'Reorder heatmap rows or columns by aggregated value',
      description: 'Reorder heatmap rows and/or columns by aggregated cell values so high-value bands are grouped toward the front.',
      primitive: 'aggregate',
      category: 'compute',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          clusterRows: { type: 'boolean' },
          clusterCols: { type: 'boolean' },
          method: { type: 'string' },
        },
      },
      postconditions: [
        {
          description: 'The heatmap x/y encodings should carry explicit aggregate sort metadata for the requested rows and/or columns.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget with a color field on the current spec.',
          failureMessage: 'heatmap.clusterRowsCols requires a valid heatmap target widget with a color encoding field.',
        },
      ],
      examples: [
        {
          userGoal: 'Bring the hottest rows and columns toward the front of the matrix.',
          params: { clusterRows: true, clusterCols: true, method: 'sum' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'heatmap.transpose',
      title: 'Transpose heatmap axes',
      description: 'Swap the heatmap x and y encodings to quickly inspect the matrix from the opposite orientation.',
      primitive: 'reencode',
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
          description: 'The heatmap x and y encodings should be swapped, and width/height should swap when both are defined.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid heatmap widget in the current workspace.',
          failureMessage: 'heatmap.transpose requires a valid heatmap target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Flip rows and columns to compare the matrix from the opposite orientation.',
          params: {},
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerHeatmapActions(actionExecutor) {
  const registerHeatmapCellAction = (name, invalidTargetMessage, invalidParamsMessage) => {
    if (actionExecutor.has(name)) return
    actionExecutor.register(
      { name },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: invalidTargetMessage,
        })
        const currentSpec = ctx.readCurrentSpec() || targetWidget?.rawSpec || null
        const xField = resolveHeatmapAxisFieldAlias(currentSpec, typeof params.xField === 'string' ? params.xField : null, 'x')
        const yField = resolveHeatmapAxisFieldAlias(currentSpec, typeof params.yField === 'string' ? params.yField : null, 'y')
        const xValue = isPrimitiveSelectionValue(params.xValue) ? params.xValue : null
        const yValue = isPrimitiveSelectionValue(params.yValue) ? params.yValue : null
        if (!targetWidget || !xField || !yField || xValue == null || yValue == null) {
          throw new Error(invalidParamsMessage)
        }

        const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => row?.[xField] === xValue && row?.[yField] === yValue).length
        if (name === 'heatmap.filterCells') {
          ctx.updateCurrentSpec((spec) => {
            if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
              throw new Error('No active base spec is available for heatmap cell filtering.')
            }

            let nextTransforms = replaceTaggedTransform(spec.transform, 'heatmap.filterCells.x', {
              filter: {
                field: xField,
                equal: xValue,
              },
              _widgetvaTag: 'heatmap.filterCells.x',
            })
            nextTransforms = replaceTaggedTransform(nextTransforms, 'heatmap.filterCells.y', {
              filter: {
                field: yField,
                equal: yValue,
              },
              _widgetvaTag: 'heatmap.filterCells.y',
            })

            return {
              ...spec,
              transform: nextTransforms,
            }
          })
        }

        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'cell',
          fields: [xField, yField],
          value: {
            [xField]: xValue,
            [yField]: yValue,
          },
          predicates: [
            { field: xField, op: 'equals', value: xValue },
            { field: yField, op: 'equals', value: yValue },
          ],
          count: matchedCount,
          summary: `${xField}: ${xValue}; ${yField}: ${yValue}`,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: matchedCount,
          verificationHints: [
            ...(name === 'heatmap.filterCells'
              ? [
                  'Call perception.inspectVisibleRows to verify only the requested heatmap cell remains visible.',
                  'Call perception.inspectViewConfig to verify the active heatmap spec now includes x/y equality filters for the requested cell.',
                ]
              : [
                  'Read the updated heatmap selection state.',
                  'Read linked widgets to confirm cell-level filter propagation.',
                ]),
          ],
        })
      },
    )
  }

  registerHeatmapCellAction(
    'heatmap.filterCells',
    'heatmap.filterCells requires a valid heatmap target widget.',
    'heatmap.filterCells requires a heatmap target, xField, yField, xValue, and yValue.',
  )
  registerHeatmapCellAction(
    'heatmap.selectCell',
    'heatmap.selectCell requires a valid heatmap target widget.',
    'heatmap.selectCell requires a heatmap target, xField, yField, xValue, and yValue.',
  )

  if (!actionExecutor.has('heatmap.selectSubmatrix')) {
    actionExecutor.register(
      { name: 'heatmap.selectSubmatrix' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.selectSubmatrix requires a valid heatmap target widget.',
        })
        const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : []
        const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : []
        if (!targetWidget || (xValues.length === 0 && yValues.length === 0)) {
          throw new Error('heatmap.selectSubmatrix requires a heatmap target and at least one of xValues or yValues.')
        }

        const spec = ctx.readCurrentSpec()
        const xField = spec?.encoding?.x?.field || null
        const yField = spec?.encoding?.y?.field || null
        if (!xField || !yField) {
          throw new Error('heatmap.selectSubmatrix requires x and y encodings on the active heatmap spec.')
        }

        const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => {
          const xMatch = xValues.length === 0 || xValues.includes(row?.[xField])
          const yMatch = yValues.length === 0 || yValues.includes(row?.[yField])
          return xMatch && yMatch
        }).length

        const predicates = []
        if (xValues.length > 0) {
          predicates.push({ field: xField, op: 'in', value: xValues })
        }
        if (yValues.length > 0) {
          predicates.push({ field: yField, op: 'in', value: yValues })
        }

        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'cell',
          fields: [xField, yField],
          value: {
            ...(xValues.length > 0 ? { [xField]: xValues } : {}),
            ...(yValues.length > 0 ? { [yField]: yValues } : {}),
          },
          predicates,
          count: matchedCount,
          summary: `${xField}: ${xValues.length > 0 ? xValues.join(', ') : 'all'}; ${yField}: ${yValues.length > 0 ? yValues.join(', ') : 'all'}`,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated heatmap selection state.',
            'Read linked widgets to confirm submatrix-level filter propagation.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('heatmap.drilldownAxis')) {
    actionExecutor.register(
      { name: 'heatmap.drilldownAxis' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.drilldownAxis requires a valid heatmap target widget.',
        })
        const level = typeof params.level === 'string' ? params.level.toLowerCase().trim() : null
        const value = params.value
        const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
          ? params.parent
          : {}
        if (!targetWidget || !level || value == null || value === '') {
          throw new Error('heatmap.drilldownAxis requires a heatmap target plus level and value.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap axis drill-down.')
          }

          const xEncoding = spec?.encoding?.x
          const timeField = xEncoding?.field || null
          const xType = xEncoding?.type || null
          if (!timeField) {
            throw new Error('heatmap.drilldownAxis requires a temporal x field on the active heatmap spec.')
          }
          if (xType && xType !== 'temporal') {
            throw new Error(`heatmap.drilldownAxis requires encoding.x.type=temporal, received ${xType}.`)
          }

          const heatmapState = spec._heatmap_state && typeof spec._heatmap_state === 'object'
            ? { ...spec._heatmap_state }
            : {}
          if (!heatmapState.original_x_encoding) {
            heatmapState.original_x_encoding = cloneValue(xEncoding)
          }

          const nextTransforms = Array.isArray(spec.transform)
            ? spec.transform.filter((transform) => transform?._widgetvaTag !== 'heatmap.drilldownAxis')
            : []

          const mergedParent = {
            ...(heatmapState.parent && typeof heatmapState.parent === 'object' ? heatmapState.parent : {}),
            ...parent,
          }

          let nextTimeUnit = null
          const filters = []
          let nextParent

          if (level === 'year') {
            const yearValue = Number.parseInt(value, 10)
            if (!Number.isFinite(yearValue)) {
              throw new Error(`heatmap.drilldownAxis requires an integer year value; received ${value}.`)
            }
            nextParent = { year: yearValue }
            nextTimeUnit = 'month'
            filters.push(`year(${datumRef(timeField)}) == ${yearValue}`)
          } else if (level === 'month') {
            const yearValue = Number.parseInt(mergedParent.year, 10)
            const monthValue = Number.parseInt(value, 10)
            if (!Number.isFinite(yearValue)) {
              throw new Error('heatmap.drilldownAxis month drill-down requires parent.year.')
            }
            if (!Number.isFinite(monthValue)) {
              throw new Error(`heatmap.drilldownAxis requires an integer month value; received ${value}.`)
            }
            nextParent = { year: yearValue, month: monthValue }
            nextTimeUnit = 'date'
            filters.push(`year(${datumRef(timeField)}) == ${yearValue}`)
            filters.push(`month(${datumRef(timeField)}) == ${monthValue - 1}`)
          } else if (level === 'date') {
            const yearValue = Number.parseInt(mergedParent.year, 10)
            const monthValue = Number.parseInt(mergedParent.month, 10)
            const dateValue = Number.parseInt(value, 10)
            if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue)) {
              throw new Error('heatmap.drilldownAxis date drill-down requires parent.year and parent.month.')
            }
            if (!Number.isFinite(dateValue)) {
              throw new Error(`heatmap.drilldownAxis requires an integer date value; received ${value}.`)
            }
            nextParent = { year: yearValue, month: monthValue, date: dateValue }
            nextTimeUnit = 'date'
            filters.push(`year(${datumRef(timeField)}) == ${yearValue}`)
            filters.push(`month(${datumRef(timeField)}) == ${monthValue - 1}`)
            filters.push(`date(${datumRef(timeField)}) == ${dateValue}`)
          } else {
            throw new Error(`heatmap.drilldownAxis does not support level "${level}".`)
          }

          heatmapState.parent = nextParent

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              x: {
                ...(spec.encoding?.x || {}),
                field: timeField,
                type: 'temporal',
                ...(nextTimeUnit ? { timeUnit: nextTimeUnit } : {}),
              },
            },
            transform: [
              ...nextTransforms,
              {
                filter: filters.join(' && '),
                _widgetvaTag: 'heatmap.drilldownAxis',
              },
            ],
            _heatmap_state: heatmapState,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            level,
            value,
            parent,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap x-axis timeUnit now reflects the finer drill-down level.',
            'Read the target widget view state to confirm the tagged drill-down filter now narrows the visible period.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.resetDrilldown')) {
    actionExecutor.register(
      { name: 'heatmap.resetDrilldown' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.resetDrilldown requires a valid heatmap target widget.',
        })
        if (!targetWidget) {
          throw new Error('heatmap.resetDrilldown requires a valid heatmap target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap drill-down reset.')
          }

          const heatmapState = spec._heatmap_state
          const nextSpec = { ...spec }

          if (Array.isArray(nextSpec.transform)) {
            nextSpec.transform = nextSpec.transform.filter((transform) => transform?._widgetvaTag !== 'heatmap.drilldownAxis')
          }

          const originalXEncoding = heatmapState && typeof heatmapState === 'object'
            ? heatmapState.original_x_encoding
            : null
          if (originalXEncoding && typeof originalXEncoding === 'object') {
            nextSpec.encoding = {
              ...(nextSpec.encoding || {}),
              x: cloneValue(originalXEncoding),
            }
          }

          delete nextSpec._heatmap_state
          nextSpec._navigation_state = {
            mode: 'reset',
            sourceAction: 'heatmap.resetDrilldown',
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
            'Call perception.inspectViewConfig to verify the original heatmap x-axis encoding was restored.',
            'Read the target widget view state to confirm the drill-down filter and state marker were removed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.addMarginalBars')) {
    actionExecutor.register(
      { name: 'heatmap.addMarginalBars' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.addMarginalBars requires a valid heatmap target widget.',
        })
        const op = typeof params.op === 'string' ? params.op.toLowerCase().trim() : 'mean'
        const showTop = params.showTop !== false
        const showRight = params.showRight !== false
        const barSize = Number.isFinite(params.barSize) ? Number(params.barSize) : 70
        const barColor = typeof params.barColor === 'string' && params.barColor.length > 0 ? params.barColor : '#666666'
        const allowedAgg = new Set(['mean', 'sum', 'median', 'max', 'min', 'count'])
        if (!targetWidget) {
          throw new Error('heatmap.addMarginalBars requires a valid heatmap target widget.')
        }
        if (!showTop && !showRight) {
          throw new Error('heatmap.addMarginalBars requires at least one of showTop/showRight to be true.')
        }
        if (!allowedAgg.has(op)) {
          throw new Error(`heatmap.addMarginalBars does not support op "${params.op}".`)
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap marginal bars.')
          }

          const encoding = spec.encoding || {}
          const xEncoding = encoding.x || {}
          const yEncoding = encoding.y || {}
          const colorEncoding = encoding.color || {}
          const xField = xEncoding.field
          const yField = yEncoding.field
          const valueField = colorEncoding.field
          if (!xField || !yField || !valueField) {
            throw new Error('heatmap.addMarginalBars requires encoding.x.field, encoding.y.field, and encoding.color.field on the active heatmap spec.')
          }

          const main = cloneValue(spec)
          const title = main.title
          delete main.title

          const defaultWidth = Number.isFinite(main.width) ? main.width : 400
          const defaultHeight = Number.isFinite(main.height) ? main.height : 300
          main.width = defaultWidth
          main.height = defaultHeight

          const baseData = cloneValue(main.data)
          const baseTransform = cloneValue(main.transform)
          const baseConfig = cloneValue(main.config)
          const baseBlock = () => ({
            ...(baseData !== undefined ? { data: cloneValue(baseData) } : {}),
            ...(baseTransform !== undefined ? { transform: cloneValue(baseTransform) } : {}),
            ...(baseConfig !== undefined ? { config: cloneValue(baseConfig) } : {}),
          })

          const topSpec = showTop
            ? {
                ...baseBlock(),
                mark: { type: 'bar', color: barColor },
                encoding: {
                  x: cloneValue(xEncoding),
                  y: { aggregate: op, field: valueField, type: 'quantitative', title: null },
                  tooltip: [
                    {
                      field: xField,
                      ...(xEncoding.timeUnit ? { timeUnit: xEncoding.timeUnit } : {}),
                      type: xEncoding.type || 'nominal',
                      title: xEncoding.title || xField,
                    },
                    {
                      aggregate: op,
                      field: valueField,
                      type: 'quantitative',
                      title: `${op}(${valueField})`,
                    },
                  ],
                },
                height: barSize,
                width: defaultWidth,
              }
            : null
          if (topSpec) {
            topSpec.encoding.x.axis = { labels: false, ticks: false, title: null, domain: false }
            topSpec.encoding.y.axis = { grid: false, ticks: false, title: null }
          }

          const rightSpec = showRight
            ? {
                ...baseBlock(),
                mark: { type: 'bar', color: barColor },
                encoding: {
                  y: cloneValue(yEncoding),
                  x: { aggregate: op, field: valueField, type: 'quantitative', title: null },
                  tooltip: [
                    {
                      field: yField,
                      ...(yEncoding.timeUnit ? { timeUnit: yEncoding.timeUnit } : {}),
                      type: yEncoding.type || 'nominal',
                      title: yEncoding.title || yField,
                    },
                    {
                      aggregate: op,
                      field: valueField,
                      type: 'quantitative',
                      title: `${op}(${valueField})`,
                    },
                  ],
                },
                width: barSize,
                height: defaultHeight,
              }
            : null
          if (rightSpec) {
            rightSpec.encoding.y.axis = { labels: false, ticks: false, title: null, domain: false }
            rightSpec.encoding.x.axis = { grid: false, ticks: false, title: null }
          }

          const row = {
            hconcat: [main, ...(rightSpec ? [rightSpec] : [])],
            resolve: { scale: { y: 'shared' } },
          }
          return {
            $schema: spec.$schema || 'https://vega.github.io/schema/vega-lite/v5.json',
            ...(title !== undefined ? { title } : {}),
            vconcat: [...(topSpec ? [topSpec] : []), row],
            resolve: { scale: { x: 'shared' } },
            _marginal_bars_state: {
              enabled: true,
              op,
              show_top: showTop,
              show_right: showRight,
              value_field: valueField,
              x_field: xField,
              y_field: yField,
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            op,
            showTop,
            showRight,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap was composed with top and/or right marginal bar charts.',
            'Read the target widget view state to confirm the marginal bars aggregate the original heatmap value field.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.highlightRegion')) {
    actionExecutor.register(
      { name: 'heatmap.highlightRegion' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.highlightRegion requires a valid heatmap target widget.',
        })
        const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : []
        const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : []
        if (!targetWidget || (xValues.length === 0 && yValues.length === 0)) {
          throw new Error('heatmap.highlightRegion requires a heatmap target and at least one of xValues or yValues.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap region highlighting.')
          }

          const xField = spec?.encoding?.x?.field
          const yField = spec?.encoding?.y?.field
          if (!xField || !yField) {
            throw new Error('heatmap.highlightRegion requires x and y encodings on the active heatmap spec.')
          }

          const tests = []
          if (xValues.length > 0) {
            tests.push(`indexof(${JSON.stringify(xValues)}, datum["${xField}"]) >= 0`)
          }
          if (yValues.length > 0) {
            tests.push(`indexof(${JSON.stringify(yValues)}, datum["${yField}"]) >= 0`)
          }

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              opacity: {
                condition: {
                  test: tests.join(' && '),
                  value: 1.0,
                },
                value: 0.15,
              },
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            xValues,
            yValues,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap opacity condition was updated.',
            'Read the target widget view state to confirm the requested region is emphasized.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.adjustColorScale')) {
    actionExecutor.register(
      { name: 'heatmap.adjustColorScale' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.adjustColorScale requires a valid heatmap target widget.',
        })
        const scheme = typeof params.scheme === 'string' ? params.scheme.trim() : ''
        const domain = Array.isArray(params.domain) ? params.domain : null
        if (!targetWidget || !scheme) {
          throw new Error('heatmap.adjustColorScale requires a heatmap target and a non-empty scheme.')
        }
        if (domain && domain.length !== 2) {
          throw new Error('heatmap.adjustColorScale domain must contain exactly two values when provided.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap color-scale updates.')
          }
          const nextEncoding = { ...(spec.encoding || {}) }
          nextEncoding.color = {
            ...(nextEncoding.color || {}),
            scale: {
              ...((nextEncoding.color && nextEncoding.color.scale) || {}),
              scheme,
              ...(domain ? { domain } : {}),
            },
          }
          return {
            ...spec,
            encoding: nextEncoding,
            _color_scale_state: {
              channel: 'color',
              scheme,
              ...(domain ? { domain } : {}),
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            scheme,
            ...(domain ? { domain } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap color scale scheme was updated.',
            'Read the target widget view state to confirm the requested color domain values.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.thresholdMask')) {
    actionExecutor.register(
      { name: 'heatmap.thresholdMask' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.thresholdMask requires a valid heatmap target widget.',
        })
        const minValue = Number(params.minValue)
        const maxValue = Number(params.maxValue)
        const outsideOpacity = Number.isFinite(params.outsideOpacity)
          ? Math.max(0, Math.min(1, params.outsideOpacity))
          : 0.1
        if (!targetWidget || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
          throw new Error('heatmap.thresholdMask requires a heatmap target plus finite minValue and maxValue.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap threshold masking.')
          }

          const colorEncoding = spec?.encoding?.color
          const colorField = colorEncoding?.field
          if (!colorField) {
            throw new Error('heatmap.thresholdMask requires a color encoding field on the active heatmap spec.')
          }

          const aggregate = colorEncoding?.aggregate
          const aggregateAs = colorEncoding?.as
          const valueField = aggregate
            ? (typeof aggregateAs === 'string' && aggregateAs.trim().length > 0
                ? aggregateAs.trim()
                : `${String(aggregate).toLowerCase()}_${colorField}`)
            : colorField

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              opacity: {
                condition: {
                  test: `datum['${valueField}'] >= ${minValue} && datum['${valueField}'] <= ${maxValue}`,
                  value: 1.0,
                },
                value: outsideOpacity,
              },
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            minValue,
            maxValue,
            outsideOpacity,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap opacity condition now masks values outside the requested threshold range.',
            'Read the target widget view state to confirm the requested threshold mask was applied.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.filterCellsByRegion')) {
    actionExecutor.register(
      { name: 'heatmap.filterCellsByRegion' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.filterCellsByRegion requires a valid heatmap target widget.',
        })

        const xValues = Array.isArray(params.xValues)
          ? params.xValues.filter((value) => value != null)
          : (params.xValue != null ? [params.xValue] : [])
        const yValues = Array.isArray(params.yValues)
          ? params.yValues.filter((value) => value != null)
          : (params.yValue != null ? [params.yValue] : [])
        if (!targetWidget || (xValues.length === 0 && yValues.length === 0)) {
          throw new Error('heatmap.filterCellsByRegion requires a heatmap target and at least one of xValues/yValues or xValue/yValue.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap region filtering.')
          }

          const xField = spec?.encoding?.x?.field
          const yField = spec?.encoding?.y?.field
          const xTimeUnit = spec?.encoding?.x?.timeUnit
          const yTimeUnit = spec?.encoding?.y?.timeUnit
          if (!xField || !yField) {
            throw new Error('heatmap.filterCellsByRegion requires x and y encodings on the active heatmap spec.')
          }

          let filterSpec = null
          if (xValues.length > 0 && yValues.length === 0 && !xTimeUnit) {
            filterSpec = {
              field: xField,
              notOneOf: [...xValues],
            }
          } else if (yValues.length > 0 && xValues.length === 0 && !yTimeUnit) {
            filterSpec = {
              field: yField,
              notOneOf: [...yValues],
            }
          } else {
            const excludeParts = []
            if (xValues.length > 0) {
              const { valueListExpr, datumExpr } = normalizeTimeUnitValues(xField, xValues, xTimeUnit)
              excludeParts.push(`indexof([${valueListExpr}], ${datumExpr}) >= 0`)
            }
            if (yValues.length > 0) {
              const { valueListExpr, datumExpr } = normalizeTimeUnitValues(yField, yValues, yTimeUnit)
              excludeParts.push(`indexof([${valueListExpr}], ${datumExpr}) >= 0`)
            }
            filterSpec = `!(${excludeParts.join(' && ')})`
          }

          return {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'heatmap.filterCellsByRegion', {
              filter: filterSpec,
              _widgetvaTag: 'heatmap.filterCellsByRegion',
            }),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            xValues,
            yValues,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap transform now excludes the requested region.',
            'Read the target widget rows to confirm the requested region no longer appears in the visible matrix.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.highlightRegionByValue')) {
    actionExecutor.register(
      { name: 'heatmap.highlightRegionByValue' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.highlightRegionByValue requires a valid heatmap target widget.',
        })
        const hasMin = params.minValue != null && params.minValue !== ''
        const hasMax = params.maxValue != null && params.maxValue !== ''
        const minValue = hasMin ? Number(params.minValue) : null
        const maxValue = hasMax ? Number(params.maxValue) : null
        const outsideOpacity = Number.isFinite(params.outsideOpacity)
          ? Math.max(0, Math.min(1, params.outsideOpacity))
          : 0.12
        if (!targetWidget || (!hasMin && !hasMax) || (hasMin && !Number.isFinite(minValue)) || (hasMax && !Number.isFinite(maxValue))) {
          throw new Error('heatmap.highlightRegionByValue requires a heatmap target and at least one finite minValue or maxValue.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap value-range highlighting.')
          }

          const colorEncoding = spec?.encoding?.color
          const colorField = colorEncoding?.field
          if (!colorField) {
            throw new Error('heatmap.highlightRegionByValue requires a color encoding field on the active heatmap spec.')
          }

          const aggregate = colorEncoding?.aggregate
          const aggregateAs = colorEncoding?.as
          const valueField = aggregate
            ? (typeof aggregateAs === 'string' && aggregateAs.trim().length > 0
                ? aggregateAs.trim()
                : `${String(aggregate).toLowerCase()}_${colorField}`)
            : colorField

          const tests = []
          if (hasMin) tests.push(`datum['${valueField}'] >= ${minValue}`)
          if (hasMax) tests.push(`datum['${valueField}'] <= ${maxValue}`)

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              opacity: {
                condition: {
                  test: tests.join(' && '),
                  value: 1.0,
                },
                value: outsideOpacity,
              },
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            ...(hasMin ? { minValue } : {}),
            ...(hasMax ? { maxValue } : {}),
            outsideOpacity,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap opacity condition now highlights values inside the requested range.',
            'Read the target widget view state to confirm the value-range highlight was applied without filtering data away.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.clusterRowsCols')) {
    actionExecutor.register(
      { name: 'heatmap.clusterRowsCols' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.clusterRowsCols requires a valid heatmap target widget.',
        })
        const clusterRows = params.clusterRows !== false
        const clusterCols = params.clusterCols !== false
        const requestedMethod = typeof params.method === 'string' ? params.method.toLowerCase().trim() : 'sum'
        const method = ['sum', 'mean', 'max'].includes(requestedMethod) ? requestedMethod : 'sum'
        if (!targetWidget || (!clusterRows && !clusterCols)) {
          throw new Error('heatmap.clusterRowsCols requires a heatmap target and at least one of clusterRows or clusterCols to be true.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap row/column clustering.')
          }

          const colorField = spec?.encoding?.color?.field
          if (!colorField) {
            throw new Error('heatmap.clusterRowsCols requires a color encoding field on the active heatmap spec.')
          }

          const nextEncoding = cloneValue(spec.encoding || {})
          if (clusterRows && nextEncoding.y) {
            nextEncoding.y = {
              ...nextEncoding.y,
              sort: {
                op: method,
                field: colorField,
                order: 'descending',
              },
            }
          }
          if (clusterCols && nextEncoding.x) {
            nextEncoding.x = {
              ...nextEncoding.x,
              sort: {
                op: method,
                field: colorField,
                order: 'descending',
              },
            }
          }

          return {
            ...spec,
            encoding: nextEncoding,
            _cluster_rows_cols_state: {
              cluster_rows: clusterRows,
              cluster_cols: clusterCols,
              method,
              color_field: colorField,
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            clusterRows,
            clusterCols,
            method,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap x/y encodings now carry aggregate sort metadata.',
            'Read the target widget view state to confirm the requested rows and/or columns are reordered by aggregated value.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.transpose')) {
    actionExecutor.register(
      { name: 'heatmap.transpose' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'heatmap',
          message: 'heatmap.transpose requires a valid heatmap target widget.',
        })
        if (!targetWidget) {
          throw new Error('heatmap.transpose requires a valid heatmap target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for heatmap transpose.')
          }

          const xEncoding = spec?.encoding?.x
          const yEncoding = spec?.encoding?.y
          if (!xEncoding || !yEncoding) {
            throw new Error('heatmap.transpose requires both x and y encodings on the active heatmap spec.')
          }

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              x: cloneValue(yEncoding),
              y: cloneValue(xEncoding),
            },
            ...(spec.width != null && spec.height != null ? { width: spec.height, height: spec.width } : {}),
            _transpose_state: {
              ...(spec._transpose_state || { transposed: false }),
              transposed: !(spec._transpose_state?.transposed === true),
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            transposed: nextState?._transpose_state?.transposed === true,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap x and y encodings were swapped.',
            'Read the target widget view state to confirm the transpose marker and any width/height swap were applied.',
          ],
        }
      },
    )
  }
}

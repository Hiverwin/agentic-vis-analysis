import { buildWidgetFilterPatch } from '../shared/filterPatch.js'
import { buildWidgetSelectionPatch } from '../shared/selectionPatch.js'
import {
  buildParallelDimensionVisibilityPatch,
  buildParallelHighlightPatch,
  buildParallelReorderPatch,
  buildParallelResetHiddenDimensionsPatch,
} from './semanticPatches.js'

function targetWidgetState(targetWidget) {
  return { widgets: { [targetWidget.ref]: targetWidget } }
}

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function isParallelCoordinatesMark(mark) {
  return readMarkType(mark) === 'line'
}

function isParallelCoordinatesSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return false
  const encoding = spec?.encoding
  const xField = encoding?.x?.field
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const hasFoldTransform = transforms.some((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
  return spec?.kind === 'parallelCoordinates'
    || (
      (isParallelCoordinatesMark(spec?.mark) || hasFoldTransform)
      && typeof xField === 'string'
      && ['dimension', 'key', 'variable'].includes(xField)
    )
}

function collectNestedParallelCoordinatesSpecs(spec) {
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

function findRepresentativeParallelCoordinatesSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (isParallelCoordinatesSpec(spec)) return spec
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => (
      entry && typeof entry === 'object' && isParallelCoordinatesSpec(entry)
    ))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedParallelCoordinatesSpecs(spec)) {
    const match = findRepresentativeParallelCoordinatesSpec(child)
    if (match) return match
  }
  return null
}

function readParallelRecordField(spec) {
  const representativeSpec = findRepresentativeParallelCoordinatesSpec(spec) || spec
  const rootEncoding = Array.isArray(representativeSpec?.layer) && representativeSpec.layer.length > 0
    ? representativeSpec.layer[0]?.encoding || representativeSpec?.encoding || {}
    : representativeSpec?.encoding || {}
  return typeof rootEncoding?.detail?.field === 'string' && rootEncoding.detail.field.length > 0
    ? rootEncoding.detail.field
    : 'id'
}

function countParallelSemanticRows(rows = [], spec = null, fallbackField = 'id') {
  const safeRows = Array.isArray(rows) ? rows : []
  const recordField = readParallelRecordField(spec) || fallbackField
  return new Set(
    safeRows
      .map((row) => row?.[recordField])
      .filter((value) => value != null)
      .map((value) => JSON.stringify(value)),
  ).size
}

export function registerParallelCoordinatesActions(actionExecutor) {
  if (!actionExecutor.has('parallelCoordinates.reorderDimensions')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.reorderDimensions' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const dimensionOrder = Array.isArray(params.dimensionOrder)
          ? params.dimensionOrder.filter((dimension) => typeof dimension === 'string' && dimension.trim().length > 0)
          : []
        if (!targetWidget || dimensionOrder.length === 0) {
          throw new Error('parallelCoordinates.reorderDimensions requires a parallel coordinates target and a non-empty dimensionOrder.')
        }

        return {
          patch: buildParallelReorderPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            dimensionOrder,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            dimensionOrder,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the fold order and x-axis domain now match the requested dimension ordering.',
            'Read the target widget view state to confirm the visible parallel-axis order was updated without changing the underlying data rows.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.selectRecord')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.selectRecord' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const recordId = params.recordId
        const field = typeof params.field === 'string' && params.field.length > 0 ? params.field : 'id'
        if (!targetWidget || recordId == null) {
          throw new Error('parallelCoordinates.selectRecord requires a parallel coordinates target and a recordId.')
        }

        const rows = ctx.readRows(targetWidget.ref)
        const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || null
        const matchedRows = rows.filter((row) => row?.[field] === recordId)
        const selectedCount = countParallelSemanticRows(matchedRows, currentSpec, field)
        const summary = matchedRows[0]?.name
          ? `Record: ${matchedRows[0].name}`
          : `${field}: ${recordId}`
        const selection = {
          selection_id: 'record',
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field,
          values: [recordId],
          predicates: [{ field, op: 'equals', value: recordId }],
          count: selectedCount,
          summary,
        }

        return {
          patch: buildWidgetSelectionPatch({
            targetWidget,
            selection,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount,
          },
          selectedCount,
          verificationHints: [
            'Read the updated parallel-coordinates selection state.',
            'Read linked widgets to confirm the selected record became the current focus subset.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.selectCohort')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.selectCohort' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const rules = Array.isArray(params.rules)
          ? params.rules
            .filter((rule) => (
              typeof rule?.dimension === 'string'
              && rule.dimension.trim().length > 0
              && Array.isArray(rule.range)
              && rule.range.length === 2
              && rule.range.every((value) => typeof value === 'number' && Number.isFinite(value))
            ))
            .map((rule) => ({
              dimension: rule.dimension.trim(),
              range: [Math.min(...rule.range), Math.max(...rule.range)],
            }))
          : []
        if (!targetWidget || rules.length === 0) {
          throw new Error('parallelCoordinates.selectCohort requires a parallel coordinates target and at least one dimension range rule.')
        }

        const rows = ctx.readRows(targetWidget.ref)
        const matchedRows = rows.filter((row) => rules.every((rule) => {
          const value = row?.[rule.dimension]
          return typeof value === 'number' && value >= rule.range[0] && value <= rule.range[1]
        }))
        const selectionId = rules.map((rule) => rule.dimension).join('-')
        const selection = {
          selection_id: selectionId,
          selection_type: 'predicate',
          source_widget_id: targetWidget.widgetId || undefined,
          fields: rules.map((rule) => rule.dimension),
          predicates: rules.map((rule) => ({ field: rule.dimension, op: 'between', value: rule.range })),
          count: countParallelSemanticRows(matchedRows, targetWidget?.currentSpec || targetWidget?.rawSpec || null),
          summary: rules.map((rule) => `${rule.dimension} in [${rule.range[0]}, ${rule.range[1]}]`).join(' and '),
        }

        return {
          patch: buildWidgetSelectionPatch({ targetWidget, selection }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            rules,
            selectedCount: selection.count,
          },
          verificationHints: [
            'Read the updated parallel-coordinates predicate selection state.',
            'Read linked widgets to confirm the same multidimensional cohort was propagated.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.filterDimension')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.filterDimension' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const dimension = typeof params.dimension === 'string' && params.dimension.trim().length > 0 ? params.dimension : null
        const range = Array.isArray(params.range) && params.range.length === 2 ? params.range : null
        if (!targetWidget || !dimension || !range || !range.every((value) => typeof value === 'number' && Number.isFinite(value))) {
          throw new Error('parallelCoordinates.filterDimension requires a parallel coordinates target, a dimension, and a two-number range.')
        }

        const normalizedRange = [Math.min(...range), Math.max(...range)]
        const rows = ctx.readRows(targetWidget.ref)
        const visibleCount = rows.filter((row) => {
          const value = row?.[dimension]
          return typeof value === 'number' && value >= normalizedRange[0] && value <= normalizedRange[1]
        }).length

        return {
          patch: buildWidgetFilterPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'parallelCoordinates.filterDimension',
            field: dimension,
            value: normalizedRange,
            predicates: [{ field: dimension, op: 'between', value: normalizedRange }],
            visibleCount,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            dimension,
            range: normalizedRange,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the transform list now includes the requested numeric range filter ahead of the fold stage.',
            'Read the target widget state to confirm the filter transform is present.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.filterByCategory')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.filterByCategory' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const field = typeof params.field === 'string' && params.field.trim().length > 0 ? params.field : null
        const values = Array.isArray(params.values)
          ? params.values.filter((value) => typeof value === 'string' && value.length > 0)
          : (typeof params.values === 'string' && params.values.length > 0 ? [params.values] : [])
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('parallelCoordinates.filterByCategory requires a parallel coordinates target, a field, and one or more category values.')
        }

        const rows = ctx.readRows(targetWidget.ref)
        const visibleCount = rows.filter((row) => !values.includes(row?.[field])).length

        return {
          patch: buildWidgetFilterPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'parallelCoordinates.filterByCategory',
            field,
            values,
            predicates: [{ field, op: 'notIn', value: values }],
            visibleCount,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            field,
            values,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the transform list now includes the requested categorical exclusion filter ahead of the fold stage.',
            'Read the target widget state to confirm the filter transform is present.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.highlightCategory')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.highlightCategory' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const field = typeof params.field === 'string' && params.field.trim().length > 0 ? params.field : null
        const values = Array.isArray(params.values)
          ? params.values.filter((value) => typeof value === 'string' && value.length > 0)
          : (typeof params.values === 'string' && params.values.length > 0 ? [params.values] : [])
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('parallelCoordinates.highlightCategory requires a parallel coordinates target, a field, and one or more category values.')
        }

        return {
          patch: buildParallelHighlightPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            field,
            values,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            field,
            values,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line encoding now contains an opacity condition for the requested category values.',
            'Read the target widget view state to confirm matching categories remain visually prominent while other trajectories are dimmed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.hideDimensions')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.hideDimensions' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const dimensions = Array.isArray(params.dimensions)
          ? params.dimensions.filter((dimension) => typeof dimension === 'string' && dimension.trim().length > 0)
          : []
        const mode = params.mode === 'show' ? 'show' : 'hide'
        if (!targetWidget || dimensions.length === 0) {
          throw new Error('parallelCoordinates.hideDimensions requires a parallel coordinates target and at least one dimension.')
        }

        return {
          patch: buildParallelDimensionVisibilityPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            dimensions,
            mode,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            dimensions,
            mode,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the visible fold order and x-axis domain no longer include the hidden dimensions.',
            'Read the target widget view state to confirm the original full dimension list remains stored for later restoration.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.resetHiddenDimensions')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.resetHiddenDimensions' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        if (!targetWidget) {
          throw new Error('parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget.')
        }

        return {
          patch: buildParallelResetHiddenDimensionsPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the full original dimension order has been restored on the fold transform and x-axis domain metadata.',
            'Read the target widget view state to confirm the hidden-dimension bookkeeping state has been cleared.',
          ],
        }
      },
    )
  }
}

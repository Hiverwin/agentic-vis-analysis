import { makeActionDescriptor, makeFilterEffect, makeSelectionEffect } from '../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../../adapters/widgets/shared/selectionResult.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function updateParallelXOrder(node, dimensionOrder) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const entry of node) updateParallelXOrder(entry, dimensionOrder)
    return
  }

  if (node.encoding && typeof node.encoding === 'object') {
    const xEncoding = node.encoding.x
    if (xEncoding && typeof xEncoding === 'object' && ['dimension', 'key', 'variable'].includes(xEncoding.field)) {
      node.encoding.x = {
        ...xEncoding,
        sort: dimensionOrder,
        scale: {
          ...(xEncoding.scale || {}),
          domain: dimensionOrder,
        },
      }
    }
  }

  for (const value of Object.values(node)) {
    updateParallelXOrder(value, dimensionOrder)
  }
}

export function buildParallelCoordinatesActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['parallelCoordinates']
  return [
    makeActionDescriptor({
      name: 'parallelCoordinates.brushAxes',
      title: 'Brush parallel coordinate axes',
      description: 'Select rows whose values fall inside one or more axis-aligned numeric ranges.',
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
          rules: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                range: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
              },
              required: ['field', 'range'],
            },
          },
        },
        required: ['rules'],
      },
      postconditions: [
        {
          description: 'The active selection should contain interval predicates for the requested axes.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.brushAxes requires a valid parallel coordinates target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a multivariate interval selection over parallel axes.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may be filtered by the brushed multivariate range.')),
      ],
      examples: [
        {
          userGoal: 'Restrict analysis to a multivariate value corridor.',
          params: { rules: [{ field: 'Horsepower', range: [80, 160] }, { field: 'Weight_in_lbs', range: [1800, 3200] }] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.selectRecord',
      title: 'Select one parallel-coordinate record',
      description: 'Select one visible record by id so linked views can focus or compare that record without needing a brush gesture.',
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
          recordId: {
            anyOf: [{ type: 'string' }, { type: 'number' }],
          },
          field: { type: 'string' },
        },
        required: ['recordId'],
      },
      postconditions: [
        {
          description: 'The active selection should contain one equality predicate targeting the selected record id.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.selectRecord requires a valid parallel coordinates target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a record-level selection anchored to one parallel-coordinates row.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may update to the selected record detail.')),
      ],
      examples: [
        {
          userGoal: 'Select one car record in the parallel view before checking the same car across other linked views.',
          params: { field: 'id', recordId: 'toyota-corona-mark-ii' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.reorderDimensions',
      title: 'Reorder parallel-coordinate dimensions',
      description: 'Reorder the visible dimension axes of a parallel coordinates view by rewriting the fold order and matching x-axis domain metadata.',
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
          dimensionOrder: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
        },
        required: ['dimensionOrder'],
      },
      postconditions: [
        {
          description: 'The fold transform and any matching parallel-coordinate x-axis scale domain metadata should reflect the requested dimension order.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.reorderDimensions requires a valid parallel coordinates target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Move the most important dimensions to the front before comparing multivariate trends.',
          params: { dimensionOrder: ['Weight', 'Horsepower', 'Miles_per_Gallon'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.filterDimension',
      title: 'Filter a parallel-coordinate dimension',
      description: 'Filter rows by a numeric range on one named dimension, inserting the predicate before the fold stage when the view is defined in wide format.',
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
          dimension: { type: 'string' },
          range: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'number' },
          },
        },
        required: ['dimension', 'range'],
      },
      postconditions: [
        {
          description: 'The transform list should contain a numeric range predicate for the requested dimension, inserted ahead of the fold transform when present.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.filterDimension requires a valid parallel coordinates target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Keep only rows whose horsepower falls inside a specific corridor before comparing the remaining multivariate trajectories.',
          params: { dimension: 'Horsepower', range: [80, 160] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.filterByCategory',
      title: 'Filter a parallel-coordinate category field',
      description: 'Exclude rows whose category field matches one or more requested values, inserting the predicate before the fold stage when the view is defined in wide format.',
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
          field: { type: 'string' },
          values: {
            oneOf: [
              { type: 'string' },
              {
                type: 'array',
                minItems: 1,
                items: { type: 'string' },
              },
            ],
          },
        },
        required: ['field', 'values'],
      },
      postconditions: [
        {
          description: 'The transform list should contain a categorical exclusion predicate for the requested field, inserted ahead of the fold transform when present.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.filterByCategory requires a valid parallel coordinates target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Exclude one or more categories before comparing the remaining multivariate trajectories.',
          params: { field: 'Origin', values: ['USA', 'Japan'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.highlightCategory',
      title: 'Highlight a parallel-coordinate category field',
      description: 'Visually emphasize one or more category values by keeping matching trajectories fully opaque and dimming the rest.',
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
          field: { type: 'string' },
          values: {
            oneOf: [
              { type: 'string' },
              {
                type: 'array',
                minItems: 1,
                items: { type: 'string' },
              },
            ],
          },
        },
        required: ['field', 'values'],
      },
      postconditions: [
        {
          description: 'The target line encoding should contain an opacity condition that keeps matching categories opaque and dims the rest.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.highlightCategory requires a valid parallel coordinates target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Highlight a few categories before comparing their multivariate trajectories against the background population.',
          params: { field: 'Origin', values: ['USA', 'Japan'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.hideDimensions',
      title: 'Hide or restore parallel-coordinate dimensions',
      description: 'Temporarily hide one or more dimensions from a parallel coordinates view while preserving the original full dimension order for later restoration.',
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
          dimensions: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          mode: {
            type: 'string',
            enum: ['hide', 'show'],
          },
        },
        required: ['dimensions'],
      },
      postconditions: [
        {
          description: 'The fold order and matching x-axis domain metadata should exclude hidden dimensions and preserve the original full dimension list in widget state.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.hideDimensions requires a valid parallel coordinates target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Temporarily hide weight from a crowded parallel-coordinates view.',
          params: { dimensions: ['Weight'] },
        },
        {
          userGoal: 'Restore one previously hidden dimension without resetting the full view.',
          params: { dimensions: ['Weight'], mode: 'show' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'parallelCoordinates.resetHiddenDimensions',
      title: 'Reset hidden parallel-coordinate dimensions',
      description: 'Restore the full original dimension order after one or more dimensions have been hidden from a parallel coordinates view.',
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
          description: 'The full dimension list should be restored to the fold transform and matching x-axis domain metadata, and hidden-dimension widget state should be cleared.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.',
          failureMessage: 'parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Restore every temporarily hidden dimension after a focused inspection pass.',
          params: {},
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerParallelCoordinatesActions(actionExecutor) {
  if (!actionExecutor.has('parallelCoordinates.brushAxes')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.brushAxes' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
        })
        const rules = Array.isArray(params.rules)
          ? params.rules.filter((rule) => typeof rule?.field === 'string' && Array.isArray(rule?.range) && rule.range.length === 2)
          : []
        if (!targetWidget || rules.length === 0) {
          throw new Error('parallelCoordinates.brushAxes requires a parallel coordinates target and at least one valid rule.')
        }

        const { rows } = ctx.readRowsForWidget(targetWidget.ref)
        const normalizedRules = rules.map((rule) => ({
          field: rule.field,
          range: [Math.min(...rule.range), Math.max(...rule.range)],
        }))
        const filtered = rows.filter((row) =>
          normalizedRules.every((rule) => {
            const value = row?.[rule.field]
            return typeof value === 'number' && value >= rule.range[0] && value <= rule.range[1]
          }),
        )

        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'interval',
          fields: normalizedRules.map((rule) => rule.field),
          value: Object.fromEntries(normalizedRules.map((rule) => [rule.field, rule.range])),
          predicates: normalizedRules.map((rule) => ({
            field: rule.field,
            op: 'between',
            value: rule.range,
          })),
          count: filtered.length,
          summary: normalizedRules.map((rule) => `${rule.field} ${rule.range[0]}~${rule.range[1]}`).join('; '),
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: filtered.length,
          verificationHints: [
            'Read the updated parallel coordinates selection state.',
            'Read linked widgets to confirm multivariate range propagation.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.reorderDimensions')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.reorderDimensions' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.reorderDimensions requires a valid parallel coordinates target widget.',
        })
        const dimensionOrder = Array.isArray(params.dimensionOrder)
          ? params.dimensionOrder.filter((dimension) => typeof dimension === 'string' && dimension.trim().length > 0)
          : []
        if (!targetWidget || dimensionOrder.length === 0) {
          throw new Error('parallelCoordinates.reorderDimensions requires a parallel coordinates target and a non-empty dimensionOrder.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for parallel-dimension reordering.')
          }

          const nextSpec = cloneValue(spec)
          const transforms = Array.isArray(nextSpec.transform) ? nextSpec.transform : []
          const foldIndex = transforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))

          if (foldIndex >= 0) {
            const currentFold = transforms[foldIndex].fold
            const missing = dimensionOrder.filter((dimension) => !currentFold.includes(dimension))
            const extra = currentFold.filter((dimension) => !dimensionOrder.includes(dimension))
            if (missing.length > 0 || extra.length > 0) {
              throw new Error('parallelCoordinates.reorderDimensions must provide a complete permutation of the current fold dimensions.')
            }
            nextSpec.transform[foldIndex] = {
              ...transforms[foldIndex],
              fold: dimensionOrder,
            }
          }

          updateParallelXOrder(nextSpec, dimensionOrder)
          return nextSpec
        })

        return {
          nextState,
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
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.selectRecord requires a valid parallel coordinates target widget.',
        })
        const recordId = params.recordId
        const field = typeof params.field === 'string' && params.field.length > 0 ? params.field : 'id'
        if (!targetWidget || recordId == null) {
          throw new Error('parallelCoordinates.selectRecord requires a parallel coordinates target and a recordId.')
        }

        const { rows } = ctx.readRowsForWidget(targetWidget.ref)
        const matchedRows = rows.filter((row) => row?.[field] === recordId)
        const summary = matchedRows[0]?.name
          ? `Record: ${matchedRows[0].name}`
          : `${field}: ${recordId}`
        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field,
          values: [recordId],
          predicates: [{ field, op: 'equals', value: recordId }],
          count: matchedRows.length,
          summary,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: matchedRows.length,
          verificationHints: [
            'Read the updated parallel-coordinates selection state.',
            'Read linked widgets to confirm the selected record became the current focus subset.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.filterDimension')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.filterDimension' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.filterDimension requires a valid parallel coordinates target widget.',
        })
        const dimension = typeof params.dimension === 'string' && params.dimension.trim().length > 0 ? params.dimension : null
        const range = Array.isArray(params.range) && params.range.length === 2 ? params.range : null
        if (!targetWidget || !dimension || !range || !range.every((value) => typeof value === 'number' && Number.isFinite(value))) {
          throw new Error('parallelCoordinates.filterDimension requires a parallel coordinates target, a dimension, and a two-number range.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for parallel-dimension filtering.')
          }

          const nextSpec = cloneValue(spec)
          const transforms = Array.isArray(nextSpec.transform) ? [...nextSpec.transform] : []
          const foldIndex = transforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
          const [minValue, maxValue] = [Math.min(...range), Math.max(...range)]
          const filterTransform = {
            filter: {
              field: dimension,
              range: [minValue, maxValue],
            },
            _widgetvaTag: 'parallelCoordinates.filterDimension',
          }
          const nextTransforms = transforms.filter((transform) => transform?._widgetvaTag !== 'parallelCoordinates.filterDimension')
          if (foldIndex >= 0) {
            nextTransforms.splice(foldIndex, 0, filterTransform)
          } else {
            nextTransforms.unshift(filterTransform)
          }
          nextSpec.transform = nextTransforms
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            dimension,
            range: [Math.min(...range), Math.max(...range)],
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the transform list now includes the requested numeric range filter ahead of the fold stage.',
            'Read the target widget rows to confirm only trajectories inside the requested dimension corridor remain visible.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.filterByCategory')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.filterByCategory' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.filterByCategory requires a valid parallel coordinates target widget.',
        })
        const field = typeof params.field === 'string' && params.field.trim().length > 0 ? params.field : null
        const values = Array.isArray(params.values)
          ? params.values.filter((value) => typeof value === 'string' && value.length > 0)
          : (typeof params.values === 'string' && params.values.length > 0 ? [params.values] : [])
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('parallelCoordinates.filterByCategory requires a parallel coordinates target, a field, and one or more category values.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for parallel-category filtering.')
          }

          const nextSpec = cloneValue(spec)
          const transforms = Array.isArray(nextSpec.transform) ? [...nextSpec.transform] : []
          const foldIndex = transforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
          const filterTransform = {
            filter: {
              field,
              notOneOf: [...values],
            },
            _widgetvaTag: 'parallelCoordinates.filterByCategory',
          }
          const nextTransforms = transforms.filter((transform) => transform?._widgetvaTag !== 'parallelCoordinates.filterByCategory')
          if (foldIndex >= 0) {
            nextTransforms.splice(foldIndex, 0, filterTransform)
          } else {
            nextTransforms.unshift(filterTransform)
          }
          nextSpec.transform = nextTransforms
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            field,
            values,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the transform list now includes the requested categorical exclusion filter ahead of the fold stage.',
            'Read the target widget rows to confirm trajectories belonging to the excluded categories no longer remain visible.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('parallelCoordinates.highlightCategory')) {
    actionExecutor.register(
      { name: 'parallelCoordinates.highlightCategory' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.highlightCategory requires a valid parallel coordinates target widget.',
        })
        const field = typeof params.field === 'string' && params.field.trim().length > 0 ? params.field : null
        const values = Array.isArray(params.values)
          ? params.values.filter((value) => typeof value === 'string' && value.length > 0)
          : (typeof params.values === 'string' && params.values.length > 0 ? [params.values] : [])
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('parallelCoordinates.highlightCategory requires a parallel coordinates target, a field, and one or more category values.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for parallel-category highlighting.')
          }

          const nextSpec = cloneValue(spec)
          const opacityEncoding = {
            condition: {
              test: `indexof([${values.map((value) => JSON.stringify(value)).join(',')}], datum['${field}']) >= 0`,
              value: 1,
            },
            value: 0.1,
          }

          const lineLayer = Array.isArray(nextSpec.layer)
            ? nextSpec.layer.find((layer) => {
                const mark = layer?.mark
                return mark === 'line' || (mark && typeof mark === 'object' && mark.type === 'line')
              })
            : null

          if (lineLayer && typeof lineLayer === 'object') {
            lineLayer.encoding = {
              ...(lineLayer.encoding || {}),
              opacity: opacityEncoding,
            }
          } else {
            nextSpec.encoding = {
              ...(nextSpec.encoding || {}),
              opacity: opacityEncoding,
            }
          }

          return nextSpec
        })

        return {
          nextState,
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
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.hideDimensions requires a valid parallel coordinates target widget.',
        })
        const dimensions = Array.isArray(params.dimensions)
          ? params.dimensions.filter((dimension) => typeof dimension === 'string' && dimension.trim().length > 0)
          : []
        const mode = params.mode === 'show' ? 'show' : 'hide'
        if (!targetWidget || dimensions.length === 0) {
          throw new Error('parallelCoordinates.hideDimensions requires a parallel coordinates target and at least one dimension.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for hiding parallel-coordinate dimensions.')
          }

          const nextSpec = cloneValue(spec)
          const transforms = Array.isArray(nextSpec.transform) ? nextSpec.transform : []
          const foldIndex = transforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
          const storedState = nextSpec._pc_hidden_state && typeof nextSpec._pc_hidden_state === 'object'
            ? nextSpec._pc_hidden_state
            : {}
          const allDimensions = Array.isArray(storedState.all_dimensions) && storedState.all_dimensions.length > 0
            ? [...storedState.all_dimensions]
            : (foldIndex >= 0 ? [...transforms[foldIndex].fold] : [])
          if (allDimensions.length === 0) {
            throw new Error('parallelCoordinates.hideDimensions could not determine the full dimension list for the current view.')
          }

          const hiddenSet = new Set(Array.isArray(storedState.hidden) ? storedState.hidden : [])
          for (const dimension of dimensions) {
            if (!allDimensions.includes(dimension)) {
              throw new Error(`parallelCoordinates.hideDimensions cannot find dimension "${dimension}" in the current view.`)
            }
            if (mode === 'hide') hiddenSet.add(dimension)
            else hiddenSet.delete(dimension)
          }

          const visibleDimensions = allDimensions.filter((dimension) => !hiddenSet.has(dimension))
          if (visibleDimensions.length === 0) {
            throw new Error('parallelCoordinates.hideDimensions must leave at least one visible dimension.')
          }

          if (foldIndex >= 0) {
            nextSpec.transform[foldIndex] = {
              ...transforms[foldIndex],
              fold: visibleDimensions,
            }
          }

          updateParallelXOrder(nextSpec, visibleDimensions)
          nextSpec._pc_hidden_state = {
            hidden: allDimensions.filter((dimension) => hiddenSet.has(dimension)),
            all_dimensions: allDimensions,
          }
          nextSpec._pc_reencode_state = {
            mode: 'dimensionVisibility',
            sourceAction: 'parallelCoordinates.hideDimensions',
            operation: mode,
            hidden_dimensions: allDimensions.filter((dimension) => hiddenSet.has(dimension)),
            visible_dimensions: visibleDimensions,
          }
          return nextSpec
        })

        return {
          nextState,
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
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'parallelCoordinates',
          message: 'parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget.',
        })
        if (!targetWidget) {
          throw new Error('parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for resetting hidden parallel-coordinate dimensions.')
          }

          const nextSpec = cloneValue(spec)
          const hiddenState = nextSpec._pc_hidden_state && typeof nextSpec._pc_hidden_state === 'object'
            ? nextSpec._pc_hidden_state
            : null
          const allDimensions = Array.isArray(hiddenState?.all_dimensions) ? hiddenState.all_dimensions : []
          if (allDimensions.length === 0) {
            return nextSpec
          }

          const transforms = Array.isArray(nextSpec.transform) ? nextSpec.transform : []
          const foldIndex = transforms.findIndex((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
          if (foldIndex >= 0) {
            nextSpec.transform[foldIndex] = {
              ...transforms[foldIndex],
              fold: [...allDimensions],
            }
          }

          updateParallelXOrder(nextSpec, [...allDimensions])
          nextSpec._pc_reencode_state = {
            mode: 'dimensionVisibility',
            sourceAction: 'parallelCoordinates.resetHiddenDimensions',
            operation: 'reset',
            hidden_dimensions: [],
            visible_dimensions: [...allDimensions],
          }
          delete nextSpec._pc_hidden_state
          return nextSpec
        })

        return {
          nextState,
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

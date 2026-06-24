import { makeActionDescriptor, makeHighlightEffect, makeSelectionEffect } from '../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../../adapters/widgets/shared/selectionResult.js'

function replaceFilterTransformForField(transforms, field, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => transform?.filter?.field !== field)
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function replaceTaggedTransform(transforms, tag, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => transform?._widgetvaTag !== tag)
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function detectSubcategoryField(spec, explicitField) {
  if (typeof explicitField === 'string' && explicitField.trim().length > 0) return explicitField
  const encoding = spec?.encoding || {}
  return encoding?.xOffset?.field || encoding?.color?.field || null
}

function detectCategoryField(spec, explicitField) {
  if (typeof explicitField === 'string' && explicitField.trim().length > 0) return explicitField
  const encoding = spec?.encoding || {}
  const xField = encoding?.x?.field || null
  const yField = encoding?.y?.field || null
  const xType = encoding?.x?.type || null
  const yType = encoding?.y?.type || null

  if ((xType === 'nominal' || xType === 'ordinal') && xField) return xField
  if ((yType === 'nominal' || yType === 'ordinal') && yField) return yField
  return xField || yField || null
}

function detectBarChannels(spec, requestedChannel) {
  const encoding = spec?.encoding || {}
  const xType = encoding?.x?.type || null
  const yType = encoding?.y?.type || null
  const normalizedRequested = requestedChannel === 'x' || requestedChannel === 'y' ? requestedChannel : null

  if (normalizedRequested) {
    return {
      categoryChannel: normalizedRequested,
      valueChannel: normalizedRequested === 'x' ? 'y' : 'x',
    }
  }

  if ((yType === 'nominal' || yType === 'ordinal') && xType === 'quantitative') {
    return { categoryChannel: 'y', valueChannel: 'x' }
  }
  return { categoryChannel: 'x', valueChannel: 'y' }
}

function aggregateBarValues(rows, { categoryField, valueField, aggregate, colorField, bySubcategory }) {
  const scores = new Map()
  const normalizedAggregate = typeof aggregate === 'string' && aggregate.trim().length > 0
    ? aggregate.toLowerCase()
    : 'mean'

  const groupedValues = new Map()
  const pushValue = (key, value) => {
    if (!groupedValues.has(key)) groupedValues.set(key, [])
    groupedValues.get(key).push(value)
  }

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const category = row[categoryField]
    const value = row[valueField]
    if (category == null || typeof value !== 'number' || Number.isNaN(value)) continue

    if (bySubcategory != null) {
      if (!colorField || row[colorField] !== bySubcategory) continue
      pushValue(category, value)
      continue
    }

    if (colorField) {
      const compositeKey = JSON.stringify([category, row[colorField]])
      pushValue(compositeKey, value)
      continue
    }

    pushValue(category, value)
  }

  const applyAggregate = (values) => {
    if (!Array.isArray(values) || values.length === 0) return 0
    if (normalizedAggregate === 'sum') return values.reduce((sum, value) => sum + value, 0)
    if (normalizedAggregate === 'count') return values.length
    if (normalizedAggregate === 'median') {
      const sorted = [...values].sort((left, right) => left - right)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
    if (normalizedAggregate === 'min') return Math.min(...values)
    if (normalizedAggregate === 'max') return Math.max(...values)
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  if (bySubcategory != null || !colorField) {
    for (const [key, values] of groupedValues.entries()) {
      scores.set(key, applyAggregate(values))
    }
    return scores
  }

  const groupedByCategory = new Map()
  for (const [compositeKey, values] of groupedValues.entries()) {
    const [category] = JSON.parse(compositeKey)
    groupedByCategory.set(category, (groupedByCategory.get(category) || 0) + applyAggregate(values))
  }
  return groupedByCategory
}

function hasInlineObjectRows(spec) {
  return Array.isArray(spec?.data?.values)
    && spec.data.values.some((row) => row && typeof row === 'object')
}

function isUrlBackedDataSpec(spec) {
  return typeof spec?.data?.url === 'string' && spec.data.url.trim().length > 0
}

function resolveBarRowsForAction(spec, ctx, widgetRef) {
  if (hasInlineObjectRows(spec)) {
    return spec.data.values.filter((row) => row && typeof row === 'object')
  }

  if (isUrlBackedDataSpec(spec)) {
    const { rows } = ctx.readRowsForWidget(widgetRef)
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : []
  }

  return []
}

export function buildBarActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['bar']
  return [
    makeActionDescriptor({
      name: 'bar.selectCategory',
      title: 'Select bar categories',
      description: 'Select one or more categorical groups represented by bars.',
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
          field: { type: 'string' },
          values: { type: 'array', items: { type: 'string' } },
        },
        required: ['field', 'values'],
      },
      postconditions: [
        {
          description: 'The active selection should contain the selected categorical values.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.selectCategory requires a valid bar target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a categorical selection on the bar chart.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeHighlightEffect(ref, 'Linked widgets may highlight or filter the selected categories.')),
      ],
      examples: [
        {
          userGoal: 'Select a subset of categories from the summary bar chart.',
          params: { field: 'Origin', values: ['Japan', 'USA'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.sortBars',
      title: 'Sort bars',
      description: 'Sort bar groups by the requested order and optional field.',
      primitive: 'sort',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'encodings' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          order: { type: 'string', enum: ['ascending', 'descending'] },
          field: { type: 'string' },
          aggregate: { type: 'string' },
          bySubcategory: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        },
        required: ['channel', 'order'],
      },
      postconditions: [
        {
          description: 'The bar chart encoding should include the requested sort rule.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.sortBars requires a valid bar target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Sort the bar chart descending by the aggregated measure.',
          params: {
            channel: 'x',
            order: 'descending',
          },
        },
        {
          userGoal: 'Sort grouped or stacked categories using one specific subcategory as the ranking signal.',
          params: {
            channel: 'x',
            order: 'descending',
            bySubcategory: 'Type1',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.highlightTopN',
      title: 'Highlight top N bars',
      description: 'Visually emphasize the top-N categories by measure while dimming the remaining bars.',
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
          n: { type: 'number' },
          order: { type: 'string', enum: ['ascending', 'descending'] },
          categoryField: { type: 'string' },
          measureField: { type: 'string' },
        },
        required: ['n'],
      },
      postconditions: [
        {
          description: 'The bar chart should visually emphasize the top-N categories by the requested measure.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.highlightTopN requires a valid bar target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Highlight only the top 5 categories by value before comparing them.',
          params: {
            n: 5,
            order: 'descending',
            categoryField: 'category',
            measureField: 'value',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.filterCategories',
      title: 'Filter bar categories',
      description: 'Filter the bar chart to a requested set of categories while leaving the other encodings intact.',
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
          categories: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          field: { type: 'string' },
        },
        required: ['categories'],
      },
      postconditions: [
        {
          description: 'The bar chart should retain only the requested categories through a categorical filter transform.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.filterCategories requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The bar chart data is filtered down to the requested categories.'
          : 'Linked widgets may update to reflect the reduced category set.')),
      examples: [
        {
          userGoal: 'Keep only a few categories before comparing them in detail.',
          params: {
            categories: ['A', 'C'],
            field: 'category',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.addBars',
      title: 'Add bars back into view',
      description: 'Expand the managed visible-category set of a bar chart by adding one or more category bars back into the visibility filter.',
      primitive: 'addRemove',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          values: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          field: { type: 'string' },
        },
        required: ['values'],
      },
      postconditions: [
        {
          description: 'The bar chart visibility filter should expand to include the requested categories, and the stored bar visibility state should reflect the new visible set.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.addBars requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The managed bar visibility filter expands to include the requested categories.'
          : 'Linked widgets may update to reflect the expanded category set.')),
      examples: [
        {
          userGoal: 'Add previously hidden categories back into the current bar comparison without resetting the rest of the view.',
          params: {
            values: ['East', 'West'],
            field: 'category',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.removeBars',
      title: 'Remove bars from view',
      description: 'Shrink the managed visible-category set of a bar chart by removing one or more category bars from the visibility filter.',
      primitive: 'addRemove',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          values: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          field: { type: 'string' },
        },
        required: ['values'],
      },
      postconditions: [
        {
          description: 'The bar chart visibility filter should exclude the requested categories, and the stored bar visibility state should reflect the reduced visible set.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.removeBars requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The managed bar visibility filter contracts to exclude the requested categories.'
          : 'Linked widgets may update to reflect the reduced category set.')),
      examples: [
        {
          userGoal: 'Temporarily remove several categories from the current bar comparison without resetting the rest of the view.',
          params: {
            values: ['East', 'West'],
            field: 'category',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.addBarItems',
      title: 'Add grouped or stacked bar items back into view',
      description: 'Expand the managed visible item set of a grouped or stacked bar chart by adding one or more (category, subcategory) pairs back into the visibility filter.',
      primitive: 'addRemove',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                sub: { anyOf: [{ type: 'string' }, { type: 'number' }] },
              },
              required: ['x', 'sub'],
            },
          },
          xField: { type: 'string' },
          subField: { type: 'string' },
        },
        required: ['items'],
      },
      postconditions: [
        {
          description: 'The bar chart visibility filter should expand to include the requested (category, subcategory) items, and the stored visibility state should reflect the updated visible item set.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.addBarItems requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The managed bar-item visibility filter expands to include the requested grouped or stacked members.'
          : 'Linked widgets may update to reflect the expanded item set.')),
      examples: [
        {
          userGoal: 'Bring a few grouped or stacked members back into the current comparison without resetting the whole chart.',
          params: {
            items: [{ x: 'A', sub: 'Type2' }],
            xField: 'category',
            subField: 'type',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.removeBarItems',
      title: 'Remove grouped or stacked bar items from view',
      description: 'Shrink the managed visible item set of a grouped or stacked bar chart by removing one or more (category, subcategory) pairs from the visibility filter.',
      primitive: 'addRemove',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                sub: { anyOf: [{ type: 'string' }, { type: 'number' }] },
              },
              required: ['x', 'sub'],
            },
          },
          xField: { type: 'string' },
          subField: { type: 'string' },
        },
        required: ['items'],
      },
      postconditions: [
        {
          description: 'The bar chart visibility filter should exclude the requested (category, subcategory) items, and the stored visibility state should reflect the reduced visible item set.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.removeBarItems requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The managed bar-item visibility filter contracts to exclude the requested grouped or stacked members.'
          : 'Linked widgets may update to reflect the reduced item set.')),
      examples: [
        {
          userGoal: 'Temporarily remove a few grouped or stacked members from the current comparison without resetting the whole chart.',
          params: {
            items: [{ x: 'A', sub: 'Type2' }],
            xField: 'category',
            subField: 'type',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.filterSubcategories',
      title: 'Filter bar subcategories',
      description: 'Exclude one or more grouped or stacked subcategories from the current bar chart while preserving the remaining categories.',
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
          subcategoriesToRemove: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          subField: { type: 'string' },
        },
        required: ['subcategoriesToRemove'],
      },
      postconditions: [
        {
          description: 'The bar chart transform list should exclude the requested subcategories, and the color domain should drop them when explicitly enumerated.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.filterSubcategories requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The requested grouped or stacked subcategories are excluded from the current bar chart.'
          : 'Linked widgets may update to reflect the removed subcategories.')),
      examples: [
        {
          userGoal: 'Remove several grouped or stacked subcategories before comparing the remaining composition.',
          params: {
            subcategoriesToRemove: ['Type2'],
            subField: 'type',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.expandStack',
      title: 'Expand a stacked bar into parallel bars',
      description: 'Filter to one category from a stacked bar chart and expand its stacked segments into parallel bars for easier comparison.',
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
          category: {
            anyOf: [{ type: 'string' }, { type: 'number' }],
          },
        },
        required: ['category'],
      },
      postconditions: [
        {
          description: 'The bar chart should filter to the requested category, move the stacked grouping field onto the x-axis, and remove y-axis stacking.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.expandStack requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The stacked category is expanded into side-by-side bars for direct comparison.'
          : 'Linked widgets may update to reflect the expanded stacked-bar focus view.')),
      examples: [
        {
          userGoal: 'Expand one stacked category to compare its internal composition without stacked baselines.',
          params: {
            category: 'East China',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'bar.toggleStackMode',
      title: 'Toggle grouped or stacked mode',
      description: 'Switch a grouped/stacked bar chart between grouped and stacked display modes.',
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
          mode: { type: 'string', enum: ['grouped', 'stacked'] },
        },
        required: ['mode'],
      },
      postconditions: [
        {
          description: 'Grouped mode should add xOffset and remove y-axis stacking; stacked mode should remove xOffset and restore y-axis stacking.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid bar widget in the current workspace.',
          failureMessage: 'bar.toggleStackMode requires a valid bar target widget.',
        },
      ],
      effects: affectedRefs.map((ref) =>
        makeHighlightEffect(ref, ref === widgetRef
          ? 'The bar chart display mode switches between grouped and stacked layouts.'
          : 'Linked widgets may update to reflect the new stacked/grouped comparison view.')),
      examples: [
        {
          userGoal: 'Switch the current stacked bar chart into grouped mode for easier cross-category comparison.',
          params: {
            mode: 'grouped',
          },
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerBarActions(actionExecutor) {
  if (!actionExecutor.has('bar.selectCategory')) {
    actionExecutor.register(
      { name: 'bar.selectCategory' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
        })
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === 'string') : []
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('bar.selectCategory requires a bar target, field, and one or more values.')
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
            'Read the updated bar selection state.',
            'Read the linked widget feedback or visible rows to confirm highlight propagation.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('bar.sortBars')) {
    actionExecutor.register(
      { name: 'bar.sortBars' },
      async (call, ctx) => {
        const params = call?.params || {}
        const channel = typeof params.channel === 'string' ? params.channel : null
        const order = params.order === 'ascending' || params.order === 'descending' ? params.order : null
        const field = typeof params.field === 'string' ? params.field : null
        const aggregate = typeof params.aggregate === 'string' ? params.aggregate : null
        const bySubcategory = params.bySubcategory
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.sortBars requires a valid bar target widget.',
        })
        const targetWidgetId = targetWidget?.widgetId || null
        if (!channel || !order || !targetWidgetId) {
          throw new Error('bar.sortBars requires a bar target, channel, and order.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for bar sort updates.')
          }

          const { categoryChannel, valueChannel } = detectBarChannels(spec, channel)
          const currentCategoryChannel = spec.encoding?.[categoryChannel]
          const currentValueChannel = spec.encoding?.[valueChannel]
          if (!currentCategoryChannel || typeof currentCategoryChannel !== 'object') {
            throw new Error(`The active spec does not define encoding channel "${categoryChannel}".`)
          }
          if (!currentValueChannel || typeof currentValueChannel !== 'object') {
            throw new Error(`The active spec does not define encoding channel "${valueChannel}".`)
          }

          const categoryField = currentCategoryChannel.field
          const measureField = field && field !== categoryField
            ? field
            : currentValueChannel.field
          if (!categoryField || !measureField) {
            throw new Error('bar.sortBars requires both categorical and quantitative fields on the active bar spec.')
          }

          const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref)
          if (rows.length === 0) {
            throw new Error('bar.sortBars requires bar rows from inline values or the current runtime data view.')
          }

          const colorField = spec?.encoding?.color?.field || null
          const aggregateOp = aggregate || currentValueChannel.aggregate || 'mean'
          const sortScores = aggregateBarValues(rows, {
            categoryField,
            valueField: measureField,
            aggregate: aggregateOp,
            colorField,
            bySubcategory,
          })

          const allCategories = [...new Set(rows.map((row) => row[categoryField]).filter((value) => value != null))]
          const sortedCategories = allCategories
            .sort((left, right) => {
              const leftScore = sortScores.get(left) ?? 0
              const rightScore = sortScores.get(right) ?? 0
              if (leftScore === rightScore) return String(left).localeCompare(String(right))
              return order === 'ascending' ? leftScore - rightScore : rightScore - leftScore
            })

          const nextEncoding = {
            ...(spec.encoding || {}),
            [categoryChannel]: {
              ...currentCategoryChannel,
              sort: sortedCategories,
            },
          }
          return {
            ...spec,
            encoding: nextEncoding,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidgetId,
            channel,
            order,
            ...(field ? { field } : {}),
            ...(aggregate ? { aggregate } : {}),
            ...(bySubcategory != null ? { bySubcategory } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the bar chart encoding now uses an explicit sorted category array.',
            'Read the target widget state to confirm the requested category ranking propagated to the view.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.highlightTopN')) {
    actionExecutor.register(
      { name: 'bar.highlightTopN' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.highlightTopN requires a valid bar target widget.',
        })
        const n = Number.isFinite(params.n) ? Math.max(1, Math.floor(params.n)) : null
        const order = params.order === 'ascending' || params.order === 'descending' ? params.order : 'descending'
        if (!targetWidget || !n) {
          throw new Error('bar.highlightTopN requires a bar target and a positive integer n.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for bar highlight updates.')
          }

          const categoryField = typeof params.categoryField === 'string'
            ? params.categoryField
            : spec?.encoding?.x?.field || spec?.encoding?.y?.field || null
          const measureField = typeof params.measureField === 'string'
            ? params.measureField
            : spec?.encoding?.y?.field || spec?.encoding?.x?.field || null
          const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref)
          if (!categoryField || !measureField || rows.length === 0) {
            throw new Error('bar.highlightTopN requires category/measure fields and bar rows from inline values or the current runtime data view.')
          }

          const totals = new Map()
          for (const row of rows) {
            const category = row?.[categoryField]
            const value = row?.[measureField]
            if (category == null || typeof value !== 'number') continue
            totals.set(category, (totals.get(category) || 0) + value)
          }
          const sortedCategories = [...totals.entries()]
            .sort((a, b) => (order === 'ascending' ? a[1] - b[1] : b[1] - a[1]))
            .slice(0, n)
            .map(([category]) => category)
          if (sortedCategories.length === 0) {
            throw new Error('bar.highlightTopN could not derive any categories from the current bar data.')
          }

          const testExpr = sortedCategories
            .map((category) => `datum['${categoryField}'] == ${typeof category === 'string' ? `'${category}'` : String(category)}`)
            .join(' || ')

          return {
            ...spec,
            encoding: {
              ...(spec.encoding || {}),
              opacity: {
                condition: {
                  test: testExpr,
                  value: 1.0,
                },
                value: 0.2,
              },
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            n,
            order,
            ...(typeof params.categoryField === 'string' ? { categoryField: params.categoryField } : {}),
            ...(typeof params.measureField === 'string' ? { measureField: params.measureField } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the bar chart opacity condition now highlights the top-N categories.',
            'Read the target widget view state to confirm the requested top categories are emphasized.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.filterCategories')) {
    actionExecutor.register(
      { name: 'bar.filterCategories' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.filterCategories requires a valid bar target widget.',
        })
        const categories = Array.isArray(params.categories) ? params.categories.filter((value) => value != null) : []
        if (!targetWidget || categories.length === 0) {
          throw new Error('bar.filterCategories requires a bar target and one or more categories.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for bar category filtering.')
          }

          const field = typeof params.field === 'string'
            ? params.field
            : spec?.encoding?.x?.field || spec?.encoding?.y?.field || null
          if (!field) {
            throw new Error('bar.filterCategories requires a categorical field on the active bar spec.')
          }

          return {
            ...spec,
            transform: replaceFilterTransformForField(spec.transform, field, {
              filter: {
                field,
                oneOf: categories,
              },
            }),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            field: typeof params.field === 'string' ? params.field : undefined,
            categories,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the bar chart transform now filters to the requested categories.',
            'Read the target widget rows to confirm only the requested categories remain visible.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.addBars')) {
    actionExecutor.register(
      { name: 'bar.addBars' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.addBars requires a valid bar target widget.',
        })
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        if (!targetWidget || values.length === 0) {
          throw new Error('bar.addBars requires a bar target and one or more category values.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for expanding bar visibility.')
          }

          const field = detectCategoryField(spec, params.field)
          if (!field) {
            throw new Error('bar.addBars requires a categorical field on the active bar spec.')
          }

          const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref)
          const existingCategories = new Set(rows.map((row) => row[field]).filter((value) => value != null))
          const visibilityState = spec?._bar_visibility_state
          const visible = visibilityState?.mode === 'x' && visibilityState?.x_field === field && Array.isArray(visibilityState.visible_x)
            ? new Set(visibilityState.visible_x)
            : new Set(existingCategories)

          const missingValues = []
          for (const value of values) {
            if (existingCategories.has(value)) {
              visible.add(value)
            } else {
              missingValues.push(value)
            }
          }

          const nextVisible = [...visible].sort((left, right) => String(left).localeCompare(String(right)))
          const nextSpec = {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'bar.addBars', {
              filter: {
                field,
                oneOf: nextVisible,
              },
              _widgetvaTag: 'bar.addBars',
            }),
            _bar_visibility_state: {
              mode: 'x',
              x_field: field,
              visible_x: nextVisible,
              last_operation: 'add',
            },
          }

          if (missingValues.length > 0) {
            nextSpec._bar_visibility_state = {
              ...nextSpec._bar_visibility_state,
              missing_values: missingValues,
            }
          }

          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            values,
            ...(typeof params.field === 'string' ? { field: params.field } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the managed bar visibility filter now includes the requested categories.',
            'Read the target widget view state to confirm the visible category set expanded without resetting unrelated bar encodings.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.removeBars')) {
    actionExecutor.register(
      { name: 'bar.removeBars' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.removeBars requires a valid bar target widget.',
        })
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        if (!targetWidget || values.length === 0) {
          throw new Error('bar.removeBars requires a bar target and one or more category values.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for shrinking bar visibility.')
          }

          const field = detectCategoryField(spec, params.field)
          if (!field) {
            throw new Error('bar.removeBars requires a categorical field on the active bar spec.')
          }

          const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref)
          const existingCategories = new Set(rows.map((row) => row[field]).filter((value) => value != null))
          const visibilityState = spec?._bar_visibility_state
          const visible = visibilityState?.mode === 'x' && visibilityState?.x_field === field && Array.isArray(visibilityState.visible_x)
            ? new Set(visibilityState.visible_x)
            : new Set(existingCategories)

          for (const value of values) {
            visible.delete(value)
          }

          const nextVisible = [...visible].sort((left, right) => String(left).localeCompare(String(right)))
          return {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'bar.addBars', {
              filter: {
                field,
                oneOf: nextVisible,
              },
              _widgetvaTag: 'bar.addBars',
            }),
            _bar_visibility_state: {
              mode: 'x',
              x_field: field,
              visible_x: nextVisible,
              last_operation: 'remove',
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            values,
            ...(typeof params.field === 'string' ? { field: params.field } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the managed bar visibility filter now excludes the requested categories.',
            'Read the target widget view state to confirm the visible category set shrank without resetting unrelated bar encodings.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.addBarItems')) {
    actionExecutor.register(
      { name: 'bar.addBarItems' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.addBarItems requires a valid bar target widget.',
        })
        const items = Array.isArray(params.items)
          ? params.items.filter((item) => item && typeof item === 'object' && item.x != null && item.sub != null)
          : []
        if (!targetWidget || items.length === 0) {
          throw new Error('bar.addBarItems requires a bar target and one or more { x, sub } items.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for expanding bar-item visibility.')
          }

          const xField = detectCategoryField(spec, params.xField)
          const subField = detectSubcategoryField(spec, params.subField)
          if (!xField) {
            throw new Error('bar.addBarItems requires a categorical x field on the active bar spec.')
          }
          if (!subField) {
            throw new Error('bar.addBarItems requires a grouped or stacked subcategory field on the active bar spec.')
          }

          const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref)
          const existingPairs = new Set(
            rows
              .map((row) => (row[xField] != null && row[subField] != null ? JSON.stringify([row[xField], row[subField]]) : null))
              .filter(Boolean),
          )
          const visibilityState = spec?._bar_visibility_state
          const visiblePairs = visibilityState?.mode === 'item'
            && visibilityState?.x_field === xField
            && visibilityState?.sub_field === subField
            && Array.isArray(visibilityState.visible_items)
            ? new Set(visibilityState.visible_items.map((pair) => JSON.stringify(pair)))
            : new Set(existingPairs)

          const missingItems = []
          for (const item of items) {
            const pairKey = JSON.stringify([item.x, item.sub])
            if (existingPairs.has(pairKey)) {
              visiblePairs.add(pairKey)
            } else {
              missingItems.push({ x: item.x, sub: item.sub })
            }
          }

          const nextVisiblePairs = [...visiblePairs]
            .map((pairKey) => JSON.parse(pairKey))
            .sort((left, right) => {
              const xCompare = String(left[0]).localeCompare(String(right[0]))
              if (xCompare !== 0) return xCompare
              return String(left[1]).localeCompare(String(right[1]))
            })

          const filterExpr = nextVisiblePairs.length > 0
            ? nextVisiblePairs
              .map(([xValue, subValue]) => `(datum['${xField}'] == ${JSON.stringify(xValue)} && datum['${subField}'] == ${JSON.stringify(subValue)})`)
              .join(' || ')
            : 'false'

          const nextSpec = {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'bar.addBarItems', {
              filter: filterExpr,
              _widgetvaTag: 'bar.addBarItems',
            }),
            _bar_visibility_state: {
              mode: 'item',
              x_field: xField,
              sub_field: subField,
              visible_items: nextVisiblePairs,
              last_operation: 'add',
            },
          }

          if (missingItems.length > 0) {
            nextSpec._bar_visibility_state = {
              ...nextSpec._bar_visibility_state,
              missing_items: missingItems,
            }
          }

          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            items,
            ...(typeof params.xField === 'string' ? { xField: params.xField } : {}),
            ...(typeof params.subField === 'string' ? { subField: params.subField } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the managed bar-item visibility filter now includes the requested grouped or stacked members.',
            'Read the target widget view state to confirm the visible item set expanded without resetting unrelated bar encodings.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.removeBarItems')) {
    actionExecutor.register(
      { name: 'bar.removeBarItems' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.removeBarItems requires a valid bar target widget.',
        })
        const items = Array.isArray(params.items)
          ? params.items.filter((item) => item && typeof item === 'object' && item.x != null && item.sub != null)
          : []
        if (!targetWidget || items.length === 0) {
          throw new Error('bar.removeBarItems requires a bar target and one or more { x, sub } items.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for shrinking bar-item visibility.')
          }

          const xField = detectCategoryField(spec, params.xField)
          const subField = detectSubcategoryField(spec, params.subField)
          if (!xField) {
            throw new Error('bar.removeBarItems requires a categorical x field on the active bar spec.')
          }
          if (!subField) {
            throw new Error('bar.removeBarItems requires a grouped or stacked subcategory field on the active bar spec.')
          }

          const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref)
          const existingPairs = new Set(
            rows
              .map((row) => (row[xField] != null && row[subField] != null ? JSON.stringify([row[xField], row[subField]]) : null))
              .filter(Boolean),
          )
          const visibilityState = spec?._bar_visibility_state
          const visiblePairs = visibilityState?.mode === 'item'
            && visibilityState?.x_field === xField
            && visibilityState?.sub_field === subField
            && Array.isArray(visibilityState.visible_items)
            ? new Set(visibilityState.visible_items.map((pair) => JSON.stringify(pair)))
            : new Set(existingPairs)

          for (const item of items) {
            visiblePairs.delete(JSON.stringify([item.x, item.sub]))
          }

          const nextVisiblePairs = [...visiblePairs]
            .map((pairKey) => JSON.parse(pairKey))
            .sort((left, right) => {
              const xCompare = String(left[0]).localeCompare(String(right[0]))
              if (xCompare !== 0) return xCompare
              return String(left[1]).localeCompare(String(right[1]))
            })

          const filterExpr = nextVisiblePairs.length > 0
            ? nextVisiblePairs
              .map(([xValue, subValue]) => `(datum['${xField}'] == ${JSON.stringify(xValue)} && datum['${subField}'] == ${JSON.stringify(subValue)})`)
              .join(' || ')
            : 'false'

          return {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'bar.addBarItems', {
              filter: filterExpr,
              _widgetvaTag: 'bar.addBarItems',
            }),
            _bar_visibility_state: {
              mode: 'item',
              x_field: xField,
              sub_field: subField,
              visible_items: nextVisiblePairs,
              last_operation: 'remove',
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            items,
            ...(typeof params.xField === 'string' ? { xField: params.xField } : {}),
            ...(typeof params.subField === 'string' ? { subField: params.subField } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the managed bar-item visibility filter now excludes the requested grouped or stacked members.',
            'Read the target widget view state to confirm the visible item set shrank without resetting unrelated bar encodings.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.filterSubcategories')) {
    actionExecutor.register(
      { name: 'bar.filterSubcategories' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.filterSubcategories requires a valid bar target widget.',
        })
        const subcategoriesToRemove = Array.isArray(params.subcategoriesToRemove)
          ? params.subcategoriesToRemove.filter((value) => value != null)
          : []
        if (!targetWidget || subcategoriesToRemove.length === 0) {
          throw new Error('bar.filterSubcategories requires a bar target and one or more subcategories to remove.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for bar subcategory filtering.')
          }

          const subField = detectSubcategoryField(spec, params.subField)
          if (!subField) {
            throw new Error('bar.filterSubcategories requires a subcategory field on the active bar spec.')
          }

          const nextSpec = {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'bar.filterSubcategories', {
              filter: {
                field: subField,
                notOneOf: [...subcategoriesToRemove],
              },
              _widgetvaTag: 'bar.filterSubcategories',
            }),
          }

          const colorScaleDomain = nextSpec?.encoding?.color?.scale?.domain
          if (Array.isArray(colorScaleDomain)) {
            nextSpec.encoding = {
              ...(nextSpec.encoding || {}),
              color: {
                ...(nextSpec.encoding?.color || {}),
                scale: {
                  ...(nextSpec.encoding?.color?.scale || {}),
                  domain: colorScaleDomain.filter((value) => !subcategoriesToRemove.includes(value)),
                },
              },
            }
          }

          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            subcategoriesToRemove,
            ...(typeof params.subField === 'string' ? { subField: params.subField } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the bar chart transform now excludes the requested subcategories.',
            'Read the target widget rows and color scale metadata to confirm the removed subcategories no longer appear.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.expandStack')) {
    actionExecutor.register(
      { name: 'bar.expandStack' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.expandStack requires a valid bar target widget.',
        })
        const category = params.category
        if (!targetWidget || category == null) {
          throw new Error('bar.expandStack requires a bar target and a category value.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for stacked-bar expansion.')
          }

          const encoding = spec.encoding || {}
          const xField = encoding?.x?.field || null
          const colorEncoding = encoding?.color || {}
          const colorField = colorEncoding?.field || null
          if (!xField) {
            throw new Error('bar.expandStack requires an x encoding field on the active bar spec.')
          }
          if (!colorField) {
            throw new Error('bar.expandStack requires a color encoding field on the active stacked bar spec.')
          }

          const nextEncoding = {
            ...(encoding || {}),
            x: {
              field: colorField,
              type: 'nominal',
              title: colorEncoding?.title || colorField,
              axis: { labelAngle: -45 },
              ...(colorEncoding?.scale?.domain ? { sort: colorEncoding.scale.domain } : {}),
            },
            y: {
              ...(encoding?.y || {}),
            },
          }
          delete nextEncoding.y.stack

          return {
            ...spec,
            transform: replaceTaggedTransform(spec.transform, 'bar.expandStack', {
              filter: `datum['${xField}'] == ${JSON.stringify(category)}`,
              _widgetvaTag: 'bar.expandStack',
            }),
            encoding: nextEncoding,
            _bar_expand_stack_state: {
              category,
              category_field: xField,
              group_field: colorField,
            },
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            category,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the chart is filtered to the requested category and the x-axis now uses the stacked grouping field.',
            'Read the target widget view state to confirm y-axis stacking was removed for parallel comparison.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.toggleStackMode')) {
    actionExecutor.register(
      { name: 'bar.toggleStackMode' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'bar',
          message: 'bar.toggleStackMode requires a valid bar target widget.',
        })
        const mode = params.mode === 'grouped' || params.mode === 'stacked' ? params.mode : null
        if (!targetWidget || !mode) {
          throw new Error('bar.toggleStackMode requires a bar target and mode of either "grouped" or "stacked".')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for bar stack-mode toggling.')
          }

          const colorField = spec?.encoding?.color?.field || null
          if (!colorField) {
            throw new Error('bar.toggleStackMode requires a color encoding field on the active bar spec.')
          }

          const nextEncoding = {
            ...(spec.encoding || {}),
            y: {
              ...(spec.encoding?.y || {}),
            },
          }

          if (mode === 'grouped') {
            nextEncoding.xOffset = { field: colorField }
            delete nextEncoding.y.stack
          } else {
            delete nextEncoding.xOffset
            nextEncoding.y.stack = 'zero'
          }

          return {
            ...spec,
            encoding: nextEncoding,
            _stack_mode: mode,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            mode,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify grouped mode adds xOffset and stacked mode restores y-axis stacking.',
            'Read the target widget view state to confirm the stored stack-mode marker was updated.',
          ],
        }
      },
    )
  }
}

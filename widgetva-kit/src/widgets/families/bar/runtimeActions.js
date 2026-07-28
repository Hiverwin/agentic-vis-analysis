import { buildWidgetFilterPatch } from '../shared/filterPatch.js'
import { buildWidgetViewPatch } from '../shared/viewPatch.js'
import {
  buildBarCategorySelectionPatch,
  buildBarExpandStackPatch,
  buildBarItemVisibilityPatch,
  buildBarStackModePatch,
  buildBarVisibilityPatch,
  readCurrentWidgetState,
} from './semanticPatches.js'

function targetWidgetState(targetWidget) {
  return { widgets: { [targetWidget.ref]: targetWidget } }
}

function detectSubcategoryField(spec, explicitField) {
  const encoding = spec?.encoding || {}
  const inferredField = encoding?.xOffset?.field || encoding?.color?.field || null
  if (typeof explicitField === 'string' && explicitField.trim().length > 0) {
    return explicitField === inferredField ? explicitField : inferredField
  }
  return inferredField
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
  const xField = encoding?.x?.field || null
  const yField = encoding?.y?.field || null
  const xAggregate = encoding?.x?.aggregate || null
  const yAggregate = encoding?.y?.aggregate || null
  const normalizedRequested = requestedChannel === 'x' || requestedChannel === 'y' ? requestedChannel : null

  if (normalizedRequested) {
    const otherChannel = normalizedRequested === 'x' ? 'y' : 'x'
    const requestedEncoding = encoding?.[normalizedRequested] || {}
    const otherEncoding = encoding?.[otherChannel] || {}
    const requestedType = requestedEncoding?.type || null
    const otherType = otherEncoding?.type || null
    const requestedLooksQuantitative = requestedType === 'quantitative' || Boolean(requestedEncoding?.aggregate)
    const otherLooksCategorical = otherType === 'nominal' || otherType === 'ordinal'
    if (requestedLooksQuantitative && otherLooksCategorical) {
      return {
        categoryChannel: otherChannel,
        valueChannel: normalizedRequested,
      }
    }
    return {
      categoryChannel: normalizedRequested,
      valueChannel: otherChannel,
    }
  }

  // Vega-Lite examples often omit explicit nominal/ordinal types on the
  // category axis when the opposite axis is an aggregate count.
  if (xAggregate && yField && !yAggregate) {
    return { categoryChannel: 'y', valueChannel: 'x' }
  }
  if (yAggregate && xField && !xAggregate) {
    return { categoryChannel: 'x', valueChannel: 'y' }
  }

  if ((yType === 'nominal' || yType === 'ordinal') && xType === 'quantitative') {
    return { categoryChannel: 'y', valueChannel: 'x' }
  }
  return { categoryChannel: 'x', valueChannel: 'y' }
}

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function isBarFamilyMark(mark) {
  return readMarkType(mark) === 'bar'
}

function collectNestedBarSpecs(spec) {
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

function findRepresentativeBarSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (isBarFamilyMark(spec?.mark) && spec?.encoding && typeof spec.encoding === 'object') {
    return spec
  }
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => (
      entry && typeof entry === 'object' && isBarFamilyMark(entry?.mark) && entry?.encoding && typeof entry.encoding === 'object'
    ))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedBarSpecs(spec)) {
    const match = findRepresentativeBarSpec(child)
    if (match) return match
  }
  return null
}

function resolveBarDescriptorCapabilities(spec) {
  const representativeSpec = findRepresentativeBarSpec(spec) || spec
  const { categoryChannel } = detectBarChannels(representativeSpec, null)
  const categoryEncoding = representativeSpec?.encoding?.[categoryChannel]
  const hasCategoryField = typeof categoryEncoding?.field === 'string'
    && categoryEncoding.field.length > 0
    && categoryEncoding?.bin !== true
    && categoryEncoding?.bin !== 'binned'
  const subcategoryField = detectSubcategoryField(representativeSpec, null)
  const colorField = representativeSpec?.encoding?.color?.field || null
  return {
    hasCategoryField,
    hasSubcategoryField: hasCategoryField && Boolean(subcategoryField),
    hasColorField: Boolean(colorField),
  }
}

function uniqueSortedValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
    .sort((left, right) => String(left).localeCompare(String(right)))
}

function readBarRowsFromContext(ctx, targetWidget, rawSpec) {
  const rows = ctx.readRows(targetWidget.ref)
  return Array.isArray(rows) && rows.length > 0
    ? rows
    : Array.isArray(rawSpec?.data?.values)
      ? rawSpec.data.values
      : []
}

function resolveBarFields({ currentWidgetState, targetWidget, explicitField, explicitXField, explicitSubField }) {
  const rawSpec = currentWidgetState?.currentSpec
    || currentWidgetState?.rawSpec
    || targetWidget?.currentSpec
    || targetWidget?.rawSpec
    || null
  const representativeSpec = findRepresentativeBarSpec(rawSpec) || rawSpec
  return {
    rawSpec,
    representativeSpec,
    categoryField: detectCategoryField(representativeSpec, explicitField || explicitXField),
    subcategoryField: detectSubcategoryField(representativeSpec, explicitSubField),
    colorField: representativeSpec?.encoding?.color?.field || null,
  }
}

export function registerBarActions(actionExecutor) {
  const registerCategorySelectionAction = (actionName) => {
    if (actionExecutor.has(actionName)) return
    actionExecutor.register(
      { name: actionName },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === 'string') : []
        if (!targetWidget || !field || values.length === 0) {
          throw new Error(`${actionName} requires a bar target, field, and one or more values.`)
        }

        const visibleRows = ctx.readRows(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length
        return {
          patch: buildBarCategorySelectionPatch({
            targetWidget,
            actionName,
            field,
            values,
            selectedCount: matchedCount,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: matchedCount,
          },
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated bar selection state.',
            'Read the linked widget feedback or visible rows to confirm highlight propagation.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  registerCategorySelectionAction('bar.clickCategory')
  registerCategorySelectionAction('bar.selectCategory')

  if (!actionExecutor.has('bar.sortBars')) {
    actionExecutor.register(
      { name: 'bar.sortBars' },
      async (params, ctx) => {
        const channel = typeof params.channel === 'string' ? params.channel : null
        const order = params.order === 'ascending' || params.order === 'descending' ? params.order : null
        const field = typeof params.field === 'string' ? params.field : null
        const aggregate = typeof params.aggregate === 'string' ? params.aggregate : null
        const bySubcategory = params.bySubcategory
        const targetWidget = ctx.targetWidget()
        const targetWidgetId = targetWidget?.widgetId || null
        if (!channel || !order || !targetWidgetId) {
          throw new Error('bar.sortBars requires a bar target, channel, and order.')
        }
        const currentWidgetState = readCurrentWidgetState(targetWidgetState(targetWidget), targetWidget)
        const rawSpec = currentWidgetState?.currentSpec
          || currentWidgetState?.rawSpec
          || targetWidget?.currentSpec
          || targetWidget?.rawSpec
          || null
        const representativeSpec = findRepresentativeBarSpec(rawSpec) || rawSpec
        const detectedChannels = detectBarChannels(representativeSpec, channel)
        const categoryEncoding = representativeSpec?.encoding?.[detectedChannels.categoryChannel] || {}
        const valueEncoding = representativeSpec?.encoding?.[detectedChannels.valueChannel] || {}
        const categoryField = categoryEncoding?.field || null
        const sortField = field || valueEncoding?.field || null
        const sortAggregate = aggregate || valueEncoding?.aggregate || null

        return {
          patch: buildWidgetViewPatch({
            targetWidget,
            view: {
              sort: {
                sourceAction: 'bar.sortBars',
                channel: detectedChannels.categoryChannel,
                order,
                mode: 'direction',
                ...(categoryField ? { categoryField } : {}),
                ...(sortField ? { sortField, field: sortField } : {}),
                ...(sortAggregate ? { aggregate: sortAggregate } : {}),
                ...(bySubcategory != null ? { bySubcategory } : {}),
              },
            },
          }),
          propagateFromRef: `${targetWidget.ref}/view/sort`,
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidgetId,
            channel: detectedChannels.categoryChannel,
            order,
            ...(categoryField ? { categoryField } : {}),
            ...(sortField ? { sortField, field: sortField } : {}),
            ...(sortAggregate ? { aggregate: sortAggregate } : {}),
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const n = Number.isFinite(params.n) ? Math.max(1, Math.floor(params.n)) : null
        const order = params.order === 'ascending' || params.order === 'descending' ? params.order : 'descending'
        if (!targetWidget || !n) {
          throw new Error('bar.highlightTopN requires a bar target and a positive integer n.')
        }

        return {
          patch: buildWidgetViewPatch({
            targetWidget,
            view: {
              highlight: {
                sourceAction: 'bar.highlightTopN',
                mode: 'topN',
                n,
                order,
                ...(typeof params.categoryField === 'string' ? { categoryField: params.categoryField } : {}),
                ...(typeof params.measureField === 'string' ? { measureField: params.measureField } : {}),
              },
            },
          }),
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const categories = Array.isArray(params.categories) ? params.categories.filter((value) => value != null) : []
        if (!targetWidget || categories.length === 0) {
          throw new Error('bar.filterCategories requires a bar target and one or more categories.')
        }

        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const rawSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || targetWidget?.currentSpec || targetWidget?.rawSpec || null
        const field = typeof params.field === 'string'
          ? params.field
          : detectCategoryField(rawSpec)
        if (!field) {
          throw new Error('bar.filterCategories requires a categorical field on the active bar spec.')
        }

        const rows = ctx.readRows(targetWidget.ref)
        const baselineRows = Array.isArray(rows) && rows.length > 0
          ? rows
          : Array.isArray(rawSpec?.data?.values)
            ? rawSpec.data.values
            : []
        const nextVisibleRows = baselineRows.filter((row) => categories.includes(row?.[field]))

        return {
          patch: buildWidgetFilterPatch({
            targetWidget,
            currentState,
            actionName: 'bar.filterCategories',
            field,
            values: categories,
            predicates: [{ field, op: 'in', value: categories }],
            visibleCount: nextVisibleRows.length,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            field,
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        if (!targetWidget || values.length === 0) {
          throw new Error('bar.addBars requires a bar target and one or more category values.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { rawSpec, categoryField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
          explicitField: params.field,
        })
        if (!categoryField) {
          throw new Error('bar.addBars requires a categorical field on the active bar spec.')
        }
        const rows = readBarRowsFromContext(ctx, targetWidget, rawSpec)
        const existingValues = uniqueSortedValues(rows.map((row) => row?.[categoryField]))
        const previousVisibility = currentWidgetState.data?.analysis?.visibility
        const currentVisible = previousVisibility?.mode === 'category' && previousVisibility?.field === categoryField
          ? new Set(previousVisibility.visibleValues || [])
          : new Set(existingValues)
        for (const value of values) {
          if (existingValues.length === 0 || existingValues.includes(value)) currentVisible.add(value)
        }
        const visibleValues = uniqueSortedValues([...currentVisible])

        return {
          patch: buildBarVisibilityPatch({
            targetWidget,
            currentState,
            actionName: 'bar.addBars',
            field: categoryField,
            visibleValues,
            operation: 'add',
            changedValues: values,
            rows,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            values,
            field: categoryField,
            visibleValues,
          },
          verificationHints: [
            'Read the target widget state and confirm data.analysis.visibility includes the requested categories.',
            'Read the target widget transforms and confirm bar.addBars is recorded as a semantic filter.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.removeBars')) {
    actionExecutor.register(
      { name: 'bar.removeBars' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        if (!targetWidget || values.length === 0) {
          throw new Error('bar.removeBars requires a bar target and one or more category values.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { rawSpec, categoryField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
          explicitField: params.field,
        })
        if (!categoryField) {
          throw new Error('bar.removeBars requires a categorical field on the active bar spec.')
        }
        const rows = readBarRowsFromContext(ctx, targetWidget, rawSpec)
        const existingValues = uniqueSortedValues(rows.map((row) => row?.[categoryField]))
        const previousVisibility = currentWidgetState.data?.analysis?.visibility
        const currentVisible = previousVisibility?.mode === 'category' && previousVisibility?.field === categoryField
          ? new Set(previousVisibility.visibleValues || [])
          : new Set(existingValues)
        for (const value of values) currentVisible.delete(value)
        const visibleValues = uniqueSortedValues([...currentVisible])

        return {
          patch: buildBarVisibilityPatch({
            targetWidget,
            currentState,
            actionName: 'bar.removeBars',
            field: categoryField,
            visibleValues,
            operation: 'remove',
            changedValues: values,
            rows,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            values,
            field: categoryField,
            visibleValues,
          },
          verificationHints: [
            'Read the target widget state and confirm data.analysis.visibility excludes the requested categories.',
            'Read the target widget transforms and confirm bar.removeBars is recorded as a semantic filter.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.addBarItems')) {
    actionExecutor.register(
      { name: 'bar.addBarItems' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const items = Array.isArray(params.items)
          ? params.items.filter((item) => item && typeof item === 'object' && item.x != null && item.sub != null)
          : []
        if (!targetWidget || items.length === 0) {
          throw new Error('bar.addBarItems requires a bar target and one or more { x, sub } items.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { rawSpec, categoryField, subcategoryField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
          explicitXField: params.xField,
          explicitSubField: params.subField,
        })
        if (!categoryField || !subcategoryField) {
          throw new Error('bar.addBarItems requires category and subcategory fields on the active bar spec.')
        }
        const rows = readBarRowsFromContext(ctx, targetWidget, rawSpec)
        const existingItemKeys = new Set(rows
          .map((row) => (row?.[categoryField] != null && row?.[subcategoryField] != null
            ? JSON.stringify([row[categoryField], row[subcategoryField]])
            : null))
          .filter(Boolean))
        const previousVisibility = currentWidgetState.data?.analysis?.visibility
        const currentVisibleKeys = previousVisibility?.mode === 'item'
          && previousVisibility?.xField === categoryField
          && previousVisibility?.subField === subcategoryField
          ? new Set((previousVisibility.visibleItems || []).map((item) => JSON.stringify([item.x, item.sub])))
          : new Set(existingItemKeys)
        for (const item of items) {
          const itemKey = JSON.stringify([item.x, item.sub])
          if (existingItemKeys.size === 0 || existingItemKeys.has(itemKey)) currentVisibleKeys.add(itemKey)
        }
        const visibleItems = [...currentVisibleKeys]
          .map((itemKey) => {
            const [x, sub] = JSON.parse(itemKey)
            return { x, sub }
          })
          .sort((left, right) => `${left.x}:${left.sub}`.localeCompare(`${right.x}:${right.sub}`))

        return {
          patch: buildBarItemVisibilityPatch({
            targetWidget,
            currentState,
            actionName: 'bar.addBarItems',
            xField: categoryField,
            subField: subcategoryField,
            visibleItems,
            operation: 'add',
            changedItems: items,
            rows,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            items,
            xField: categoryField,
            subField: subcategoryField,
            visibleItems,
          },
          verificationHints: [
            'Read the target widget state and confirm data.analysis.visibility includes the requested grouped members.',
            'Read the target widget transforms and confirm bar.addBarItems is recorded as a semantic tuple filter.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.removeBarItems')) {
    actionExecutor.register(
      { name: 'bar.removeBarItems' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const items = Array.isArray(params.items)
          ? params.items.filter((item) => item && typeof item === 'object' && item.x != null && item.sub != null)
          : []
        if (!targetWidget || items.length === 0) {
          throw new Error('bar.removeBarItems requires a bar target and one or more { x, sub } items.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { rawSpec, categoryField, subcategoryField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
          explicitXField: params.xField,
          explicitSubField: params.subField,
        })
        if (!categoryField || !subcategoryField) {
          throw new Error('bar.removeBarItems requires category and subcategory fields on the active bar spec.')
        }
        const rows = readBarRowsFromContext(ctx, targetWidget, rawSpec)
        const existingItemKeys = new Set(rows
          .map((row) => (row?.[categoryField] != null && row?.[subcategoryField] != null
            ? JSON.stringify([row[categoryField], row[subcategoryField]])
            : null))
          .filter(Boolean))
        const previousVisibility = currentWidgetState.data?.analysis?.visibility
        const currentVisibleKeys = previousVisibility?.mode === 'item'
          && previousVisibility?.xField === categoryField
          && previousVisibility?.subField === subcategoryField
          ? new Set((previousVisibility.visibleItems || []).map((item) => JSON.stringify([item.x, item.sub])))
          : new Set(existingItemKeys)
        for (const item of items) currentVisibleKeys.delete(JSON.stringify([item.x, item.sub]))
        const visibleItems = [...currentVisibleKeys]
          .map((itemKey) => {
            const [x, sub] = JSON.parse(itemKey)
            return { x, sub }
          })
          .sort((left, right) => `${left.x}:${left.sub}`.localeCompare(`${right.x}:${right.sub}`))

        return {
          patch: buildBarItemVisibilityPatch({
            targetWidget,
            currentState,
            actionName: 'bar.removeBarItems',
            xField: categoryField,
            subField: subcategoryField,
            visibleItems,
            operation: 'remove',
            changedItems: items,
            rows,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            items,
            xField: categoryField,
            subField: subcategoryField,
            visibleItems,
          },
          verificationHints: [
            'Read the target widget state and confirm data.analysis.visibility excludes the requested grouped members.',
            'Read the target widget transforms and confirm bar.removeBarItems is recorded as a semantic tuple filter.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.filterSubcategories')) {
    actionExecutor.register(
      { name: 'bar.filterSubcategories' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const subcategoriesToRemove = Array.isArray(params.subcategoriesToRemove)
          ? params.subcategoriesToRemove.filter((value) => value != null)
          : []
        if (!targetWidget || subcategoriesToRemove.length === 0) {
          throw new Error('bar.filterSubcategories requires a bar target and one or more subcategories to remove.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { rawSpec, subcategoryField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
          explicitSubField: params.subField,
        })
        if (!subcategoryField) {
          throw new Error('bar.filterSubcategories requires a subcategory field on the active bar spec.')
        }
        const rows = readBarRowsFromContext(ctx, targetWidget, rawSpec)
        const visibleCount = rows.filter((row) => !subcategoriesToRemove.includes(row?.[subcategoryField])).length

        return {
          patch: buildWidgetFilterPatch({
            targetWidget,
            currentState,
            actionName: 'bar.filterSubcategories',
            field: subcategoryField,
            values: subcategoriesToRemove,
            predicates: [{ field: subcategoryField, op: 'notIn', value: subcategoriesToRemove }],
            visibleCount,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            subcategoriesToRemove,
            subField: subcategoryField,
            visibleCount,
          },
          verificationHints: [
            'Read the target widget transforms and confirm bar.filterSubcategories is recorded as a semantic filter.',
            'Read the target widget data.visibleCount to confirm the filtered row count.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.expandStack')) {
    actionExecutor.register(
      { name: 'bar.expandStack' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const category = params.category
        if (!targetWidget || category == null) {
          throw new Error('bar.expandStack requires a bar target and a category value.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { categoryField, subcategoryField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
        })
        if (!categoryField || !subcategoryField) {
          throw new Error('bar.expandStack requires category and subcategory fields on the active bar spec.')
        }

        return {
          patch: buildBarExpandStackPatch({
            targetWidget,
            currentState,
            category,
            categoryField,
            subField: subcategoryField,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            category,
            categoryField,
            subField: subcategoryField,
          },
          verificationHints: [
            'Read the target widget state and confirm view.reencode.mode is expandStack.',
            'Read the target widget transforms and confirm bar.expandStack filters to the requested category.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('bar.toggleStackMode')) {
    actionExecutor.register(
      { name: 'bar.toggleStackMode' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const mode = params.mode === 'grouped' || params.mode === 'stacked' ? params.mode : null
        if (!targetWidget || !mode) {
          throw new Error('bar.toggleStackMode requires a bar target and mode of either "grouped" or "stacked".')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
        const { subcategoryField, colorField } = resolveBarFields({
          currentWidgetState,
          targetWidget,
        })
        const subField = subcategoryField || colorField
        if (!subField) {
          throw new Error('bar.toggleStackMode requires a color or subcategory field on the active bar spec.')
        }

        return {
          patch: buildBarStackModePatch({
            targetWidget,
            currentState,
            mode,
            subField,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            mode,
            subField,
          },
          verificationHints: [
            'Read the target widget state and confirm view.reencode.mode is stackMode.',
            'Read data.analysis.stackMode to confirm the selected grouped/stacked layout.',
          ],
        }
      },
    )
  }
}

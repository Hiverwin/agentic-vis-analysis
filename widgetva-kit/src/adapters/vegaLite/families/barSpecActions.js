import {
  findRepresentativeSpec,
  updateRepresentativeSpec,
} from '../specTree.js'
import { ensureObjectSpec, readMarkType } from '../specModel.js'
import {
  replaceFilterTransformForField,
  replaceTaggedTransform,
} from '../specMutators.js'
import { expressionEqualsAny, readInlineRows } from './specActionShared.js'

function isBarFamilySpec(spec) {
  return readMarkType(spec?.mark) === 'bar'
    && spec?.encoding
    && typeof spec.encoding === 'object'
    && !Array.isArray(spec.encoding)
}

function detectBarCategoryField(spec, explicitField = null) {
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
      return { categoryChannel: otherChannel, valueChannel: normalizedRequested }
    }
    return { categoryChannel: normalizedRequested, valueChannel: otherChannel }
  }
  if (xAggregate && yField && !yAggregate) return { categoryChannel: 'y', valueChannel: 'x' }
  if (yAggregate && xField && !xAggregate) return { categoryChannel: 'x', valueChannel: 'y' }
  if ((yType === 'nominal' || yType === 'ordinal') && xType === 'quantitative') {
    return { categoryChannel: 'y', valueChannel: 'x' }
  }
  return { categoryChannel: 'x', valueChannel: 'y' }
}

function detectSubcategoryField(spec, explicitField = null) {
  const encoding = spec?.encoding || {}
  const inferredField = encoding?.xOffset?.field || encoding?.color?.field || null
  if (typeof explicitField === 'string' && explicitField.trim().length > 0) {
    return explicitField === inferredField ? explicitField : inferredField
  }
  return inferredField
}

function aggregateBarValues(rows, { categoryField, valueField, aggregate, colorField, bySubcategory }) {
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
    const value = Number(row[valueField])
    if (category == null || !Number.isFinite(value)) continue
    if (bySubcategory != null) {
      if (!colorField || row[colorField] !== bySubcategory) continue
      pushValue(category, value)
    } else if (colorField) {
      pushValue(JSON.stringify([category, row[colorField]]), value)
    } else {
      pushValue(category, value)
    }
  }
  const applyAggregate = (values) => {
    if (!values.length) return 0
    if (normalizedAggregate === 'sum') return values.reduce((sum, value) => sum + value, 0)
    if (normalizedAggregate === 'count') return values.length
    if (normalizedAggregate === 'min') return Math.min(...values)
    if (normalizedAggregate === 'max') return Math.max(...values)
    if (normalizedAggregate === 'median') {
      const sorted = [...values].sort((left, right) => left - right)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  if (bySubcategory != null || !colorField) {
    return new Map([...groupedValues.entries()].map(([key, values]) => [key, applyAggregate(values)]))
  }
  const groupedByCategory = new Map()
  for (const [compositeKey, values] of groupedValues.entries()) {
    const [category] = JSON.parse(compositeKey)
    groupedByCategory.set(category, (groupedByCategory.get(category) || 0) + applyAggregate(values))
  }
  return groupedByCategory
}

function readBarRows(spec, barSpec) {
  const directRows = readInlineRows(barSpec)
  return directRows.length > 0 ? directRows : readInlineRows(spec)
}

function updateBar(spec, updater) {
  return updateRepresentativeSpec(
    spec,
    isBarFamilySpec,
    updater,
    'No representative bar subview could be found in the active spec.',
  )
}

export function executeVegaLiteBarFilterCategories(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for bar category filtering.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const field = detectBarCategoryField(representative, params.field)
  const categories = Array.isArray(params.categories) ? params.categories.filter((value) => value != null) : []
  if (!field || categories.length === 0) throw new Error('bar.filterCategories requires categories and a field.')
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    transform: replaceFilterTransformForField(barSpec.transform, field, {
      filter: { field, oneOf: categories },
      _widgetvaTag: 'bar.filterCategories',
    }),
  }))
}

export function executeVegaLiteBarSortBars(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for bar sort updates.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const { categoryChannel, valueChannel } = detectBarChannels(representative, params.channel)
  const categoryEncoding = representative?.encoding?.[categoryChannel]
  const valueEncoding = representative?.encoding?.[valueChannel]
  const categoryField = categoryEncoding?.field
  const valueField = params.field || valueEncoding?.field
  const order = params.order === 'ascending' ? 'ascending' : 'descending'
  const rows = readBarRows(spec, representative)
  const sortedCategories = rows.length > 0 && categoryField && valueField
    ? [...new Set(rows.map((row) => row[categoryField]).filter((value) => value != null))]
        .sort((left, right) => {
          const scores = aggregateBarValues(rows, {
            categoryField,
            valueField,
            aggregate: params.aggregate || valueEncoding?.aggregate || 'mean',
            colorField: representative?.encoding?.color?.field || null,
            bySubcategory: params.bySubcategory,
          })
          const leftScore = scores.get(left) ?? 0
          const rightScore = scores.get(right) ?? 0
          if (leftScore === rightScore) return String(left).localeCompare(String(right))
          return order === 'ascending' ? leftScore - rightScore : rightScore - leftScore
        })
    : order
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    encoding: {
      ...(barSpec.encoding || {}),
      [categoryChannel]: {
        ...(barSpec.encoding?.[categoryChannel] || {}),
        sort: sortedCategories,
      },
    },
  }))
}

export function executeVegaLiteBarHighlightTopN(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for bar highlight updates.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const { categoryChannel, valueChannel } = detectBarChannels(representative, params.channel)
  const categoryEncoding = representative?.encoding?.[categoryChannel]
  const valueEncoding = representative?.encoding?.[valueChannel]
  const categoryField = params.categoryField || params.field || categoryEncoding?.field
  const measureField = params.measureField || valueEncoding?.field
  const rows = readBarRows(spec, representative)
  const n = Number.isFinite(params.n) ? Math.max(1, Math.floor(params.n)) : 3
  const order = params.order === 'ascending' ? 'ascending' : 'descending'
  if (!categoryField || !measureField || rows.length === 0) {
    throw new Error('bar.highlightTopN requires category/measure fields and inline bar rows.')
  }
  const scores = aggregateBarValues(rows, {
    categoryField,
    valueField: measureField,
    aggregate: params.aggregate || valueEncoding?.aggregate || 'mean',
    colorField: representative?.encoding?.color?.field || null,
    bySubcategory: params.bySubcategory,
  })
  const highlightedCategories = [...scores.entries()]
    .sort(([leftCategory, leftScore], [rightCategory, rightScore]) => {
      if (leftScore === rightScore) return String(leftCategory).localeCompare(String(rightCategory))
      return order === 'ascending' ? leftScore - rightScore : rightScore - leftScore
    })
    .slice(0, n)
    .map(([category]) => category)
  if (highlightedCategories.length === 0) {
    throw new Error('bar.highlightTopN could not derive any categories from the current bar data.')
  }
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    encoding: {
      ...(barSpec.encoding || {}),
      opacity: {
        condition: { test: expressionEqualsAny(categoryField, highlightedCategories), value: 1 },
        value: Number.isFinite(params.dimOpacity) ? params.dimOpacity : 0.28,
      },
      stroke: {
        condition: { test: expressionEqualsAny(categoryField, highlightedCategories), value: '#202124' },
        value: null,
      },
      strokeWidth: {
        condition: { test: expressionEqualsAny(categoryField, highlightedCategories), value: 1.5 },
        value: 0,
      },
    },
    _bar_highlight_top_n_state: {
      n,
      order,
      categoryField,
      measureField,
      highlightedCategories,
    },
  }))
}

export function executeVegaLiteBarAddRemoveBars(spec, params = {}, mode = 'add') {
  ensureObjectSpec(spec, 'No active base spec is available for bar visibility updates.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const field = detectBarCategoryField(representative, params.field)
  const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
  const explicitVisibleValues = Array.isArray(params.visibleValues)
    ? params.visibleValues.filter((value) => value != null)
    : null
  if (!field || (values.length === 0 && !explicitVisibleValues)) {
    throw new Error('bar.addBars/removeBars requires values or visibleValues and a field.')
  }
  const rows = readBarRows(spec, representative)
  const existingCategories = new Set(rows.map((row) => row[field]).filter((value) => value != null))
  const nextVisible = explicitVisibleValues
    ? [...new Set(explicitVisibleValues)].sort((left, right) => String(left).localeCompare(String(right)))
    : (() => {
        const previous = representative?._bar_visibility_state
        const visible = previous?.mode === 'x' && previous?.x_field === field && Array.isArray(previous.visible_x)
          ? new Set(previous.visible_x)
          : new Set(existingCategories)
        for (const value of values) {
          if (mode === 'add') {
            if (existingCategories.size === 0 || existingCategories.has(value)) visible.add(value)
          } else {
            visible.delete(value)
          }
        }
        return [...visible].sort((left, right) => String(left).localeCompare(String(right)))
      })()
  if (nextVisible.length === 0) {
    throw new Error('bar.addBars/removeBars requires at least one visible value after applying the update.')
  }
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    transform: replaceTaggedTransform(barSpec.transform, 'bar.addBars', {
      filter: { field, oneOf: nextVisible },
      _widgetvaTag: 'bar.addBars',
    }),
    _bar_visibility_state: {
      mode: 'x',
      x_field: field,
      visible_x: nextVisible,
      last_operation: mode === 'add' ? 'add' : 'remove',
    },
  }))
}

export function executeVegaLiteBarAddRemoveItems(spec, params = {}, mode = 'add') {
  ensureObjectSpec(spec, 'No active base spec is available for bar item visibility updates.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const xField = detectBarCategoryField(representative, params.xField)
  const subField = detectSubcategoryField(representative, params.subField)
  const items = Array.isArray(params.items)
    ? params.items.filter((item) => item && typeof item === 'object' && item.x != null && item.sub != null)
    : []
  const explicitVisibleItems = Array.isArray(params.visibleItems)
    ? params.visibleItems.filter((item) => item && typeof item === 'object' && item.x != null && item.sub != null)
    : null
  if (!xField || !subField || (items.length === 0 && !explicitVisibleItems)) {
    throw new Error('bar.addBarItems/removeBarItems requires items or visibleItems, xField, and subField.')
  }
  const rows = readBarRows(spec, representative)
  const existingPairs = new Set(rows.map((row) => (
    row[xField] != null && row[subField] != null ? JSON.stringify([row[xField], row[subField]]) : null
  )).filter(Boolean))
  const nextVisibleItems = explicitVisibleItems
    ? explicitVisibleItems
    : (() => {
        const previous = representative?._bar_visibility_state
        const visiblePairs = previous?.mode === 'item' && previous?.x_field === xField && previous?.sub_field === subField && Array.isArray(previous.visible_items)
          ? new Set(previous.visible_items.map((pair) => JSON.stringify(pair)))
          : new Set(existingPairs)
        for (const item of items) {
          const pairKey = JSON.stringify([item.x, item.sub])
          if (mode === 'add') {
            if (existingPairs.size === 0 || existingPairs.has(pairKey)) visiblePairs.add(pairKey)
          } else {
            visiblePairs.delete(pairKey)
          }
        }
        return [...visiblePairs].map((pairKey) => JSON.parse(pairKey))
      })()
  if (nextVisibleItems.length === 0) {
    throw new Error('bar.addBarItems/removeBarItems requires at least one visible item after applying the update.')
  }
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    transform: replaceTaggedTransform(barSpec.transform, 'bar.addBarItems', {
      filter: `indexof(${JSON.stringify(nextVisibleItems)}, [datum[${JSON.stringify(xField)}], datum[${JSON.stringify(subField)}]]) >= 0`,
      _widgetvaTag: 'bar.addBarItems',
    }),
    _bar_visibility_state: {
      mode: 'item',
      x_field: xField,
      sub_field: subField,
      visible_items: nextVisibleItems,
      last_operation: mode === 'add' ? 'add' : 'remove',
    },
  }))
}

export function executeVegaLiteBarFilterSubcategories(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for bar subcategory filtering.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const subField = detectSubcategoryField(representative, params.subField)
  const values = Array.isArray(params.subcategoriesToRemove)
    ? params.subcategoriesToRemove.filter((value) => value != null)
    : []
  if (!subField || values.length === 0) throw new Error('bar.filterSubcategories requires subcategoriesToRemove and subField.')
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    transform: replaceFilterTransformForField(barSpec.transform, subField, {
      filter: { not: { field: subField, oneOf: values } },
      _widgetvaTag: 'bar.filterSubcategories',
    }),
  }))
}

export function executeVegaLiteBarExpandStack(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for stacked bar expansion.')
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const categoryField = detectBarCategoryField(representative, null)
  const subField = detectSubcategoryField(representative, null)
  if (!categoryField || !subField || params.category == null) {
    throw new Error('bar.expandStack requires a category and stacked/grouped fields.')
  }
  return updateBar(spec, (barSpec) => {
    const { valueChannel } = detectBarChannels(barSpec, null)
    return {
      ...barSpec,
      transform: replaceTaggedTransform(barSpec.transform, 'bar.expandStack', {
        filter: { field: categoryField, oneOf: [params.category] },
        _widgetvaTag: 'bar.expandStack',
      }),
      encoding: {
        ...(barSpec.encoding || {}),
        x: { ...(barSpec.encoding?.x || {}), field: subField, type: 'nominal' },
        xOffset: undefined,
        [valueChannel]: { ...(barSpec.encoding?.[valueChannel] || {}), stack: null },
      },
      _bar_expand_stack_state: { category: params.category, category_field: categoryField, sub_field: subField },
    }
  })
}

export function executeVegaLiteBarToggleStackMode(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for bar stack mode updates.')
  const mode = params.mode === 'stacked' ? 'stacked' : 'grouped'
  const representative = findRepresentativeSpec(spec, isBarFamilySpec) || spec
  const colorField = representative?.encoding?.color?.field || null
  if (!colorField) throw new Error('bar.toggleStackMode requires a color/subcategory field.')
  return updateBar(spec, (barSpec) => ({
    ...barSpec,
    encoding: mode === 'grouped'
      ? {
          ...(barSpec.encoding || {}),
          xOffset: { field: colorField },
          y: { ...(barSpec.encoding?.y || {}), stack: null },
        }
      : {
          ...(barSpec.encoding || {}),
          xOffset: undefined,
          y: { ...(barSpec.encoding?.y || {}), stack: true },
        },
    _bar_stack_mode_state: { mode, sub_field: colorField },
  }))
}

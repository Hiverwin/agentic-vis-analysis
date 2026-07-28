import {
  resolveAggregateStatePayload,
  resolveAddRemoveStatePayload,
  resolveDrillDownStatePayload,
  resolveFocusPayload,
  resolveHighlightStatePayload,
  resolveNavigateStatePayload,
  resolveReencodeStatePayload,
  resolveSortPayload,
} from '../shared/providerStatePayloads.js'
import { bindEChartsFamilyInteractions } from './echartsFamilyBehavior.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readCachedState(view) {
  return view?.__widgetvaLastAppliedState && typeof view.__widgetvaLastAppliedState === 'object'
    ? view.__widgetvaLastAppliedState
    : null
}

function readCurrentOption(view) {
  if (typeof view?.getOption !== 'function') return null
  try {
    return view.getOption() || null
  } catch {
    return null
  }
}

function resolveRepresentativeSelection(selections = []) {
  const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : []
  if (normalizedSelections.length === 1) return normalizedSelections[0] || null
  const pointSelections = normalizedSelections.filter((selection) => selection?.kind === 'point')
  if (pointSelections.length === 1) return pointSelections[0] || null
  return normalizedSelections[0] || null
}

function normalizeSelections(state) {
  return Object.values(state?.selections || {}).filter(Boolean)
}

function resolvePrimaryIntervalSelection(selections = []) {
  return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === 'interval') || null
}

function resolveViewportFromState(state, intervalSelection) {
  const xDomain = state?.view?.xDomain
    || intervalSelection?.domain?.xDomain
    || null
  const yDomain = state?.view?.yDomain
    || intervalSelection?.domain?.yDomain
    || null
  const zoom = state?.view?.zoom && typeof state.view.zoom === 'object'
    ? clone(state.view.zoom)
    : null
  return normalizeViewport({
    ...(Array.isArray(xDomain) ? { xDomain } : {}),
    ...(Array.isArray(yDomain) ? { yDomain } : {}),
    ...(zoom ? { zoom } : {}),
  })
}

function selectionValues(selection) {
  const rawValues = Array.isArray(selection?.values)
    ? selection.values
    : [selection?.value]
  return rawValues.filter((value) => typeof value === 'string' || typeof value === 'number')
}

function readSeriesNames(option) {
  const seriesNames = Array.isArray(option?.series)
    ? option.series
      .map((series) => series?.name)
      .filter((name) => typeof name === 'string' && name.length > 0)
    : []
  const legendEntries = Array.isArray(option?.legend)
    ? option.legend
    : (option?.legend ? [option.legend] : [])
  const legendNames = legendEntries.flatMap((legend) => {
    const data = Array.isArray(legend?.data) ? legend.data : []
    return data
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
      .filter((name) => typeof name === 'string' && name.length > 0)
  })
  return [...new Set([...seriesNames, ...legendNames])]
}

function buildDataZoomActions(option, viewport) {
  const zoomItems = Array.isArray(option?.dataZoom)
    ? option.dataZoom
    : (option?.dataZoom ? [option.dataZoom] : [])
  const actions = []

  for (const [index, zoomItem] of zoomItems.entries()) {
    if (Array.isArray(viewport?.xDomain) && zoomItem?.xAxisIndex != null) {
      actions.push({
        type: 'dataZoom',
        dataZoomIndex: index,
        xAxisIndex: zoomItem.xAxisIndex,
        startValue: viewport.xDomain[0],
        endValue: viewport.xDomain[1],
      })
    }
    if (Array.isArray(viewport?.yDomain) && zoomItem?.yAxisIndex != null) {
      actions.push({
        type: 'dataZoom',
        dataZoomIndex: index,
        yAxisIndex: zoomItem.yAxisIndex,
        startValue: viewport.yDomain[0],
        endValue: viewport.yDomain[1],
      })
    }
  }

  return actions
}

function resolveSeriesNamesFromSelection(selection, option) {
  if (!selection || selection.kind !== 'point') return []
  const knownSeriesNames = readSeriesNames(option)
  if (knownSeriesNames.length === 0) return []
  const values = selectionValues(selection)
  if (values.length === 0) return []

  const matchingValues = values.filter((value) => knownSeriesNames.includes(String(value)))
  if (matchingValues.length !== values.length) return []

  const field = typeof selection?.field === 'string' ? selection.field.toLowerCase() : ''
  if (field.includes('series') || field.length === 0) {
    return matchingValues.map((value) => String(value))
  }

  return matchingValues.length > 0 ? matchingValues.map((value) => String(value)) : []
}

function resolveSeriesNamesFromHighlights(highlightedKeys, option) {
  const knownSeriesNames = readSeriesNames(option)
  if (knownSeriesNames.length === 0) return []
  return [...new Set(
    (Array.isArray(highlightedKeys) ? highlightedKeys : [])
      .filter((key) => typeof key === 'string' && knownSeriesNames.includes(key)),
  )]
}

function readDataItemRefs(option) {
  const seriesList = Array.isArray(option?.series) ? option.series : []
  const itemRefs = []

  for (const [seriesIndex, series] of seriesList.entries()) {
    const dataItems = Array.isArray(series?.data) ? series.data : []
    for (const [dataIndex, datum] of dataItems.entries()) {
      const name = typeof datum === 'string' || typeof datum === 'number'
        ? String(datum)
        : (typeof datum?.name === 'string' && datum.name.length > 0
            ? datum.name
            : (typeof datum?.id === 'string' && datum.id.length > 0 ? datum.id : null))
      itemRefs.push({
        seriesIndex,
        dataIndex,
        name,
        datum: datum && typeof datum === 'object' && !Array.isArray(datum) ? datum : null,
      })
    }
  }

  return itemRefs
}

function normalizeComparableValue(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : null
}

function resolveDataItemRefsFromValues(values, option) {
  const normalizedValues = [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeComparableValue(value))
      .filter(Boolean),
  )]
  if (normalizedValues.length === 0) return []

  const valueSet = new Set(normalizedValues)
  return readDataItemRefs(option).filter((itemRef) => valueSet.has(itemRef.name))
}

function normalizeFieldName(value) {
  return typeof value === 'string' && value.length > 0 ? value.toLowerCase() : null
}

function resolveDatumFieldValue(datum, field) {
  if (!datum || typeof datum !== 'object' || Array.isArray(datum)) return null
  const directValue = normalizeComparableValue(datum[field])
  if (directValue != null) return directValue

  const normalizedField = normalizeFieldName(field)
  if (!normalizedField) return null
  const matchedEntry = Object.entries(datum).find(([candidateField]) => normalizeFieldName(candidateField) === normalizedField)
  return matchedEntry ? normalizeComparableValue(matchedEntry[1]) : null
}

function resolveDataItemRefsFromSelection(selection, option) {
  const values = selectionValues(selection)
  if (values.length === 0) return []

  const field = typeof selection?.field === 'string' && selection.field.length > 0
    ? selection.field
    : null
  if (!field) {
    return resolveDataItemRefsFromValues(values, option)
  }

  const valueSet = new Set(values.map((value) => String(value)))
  const matchedRefs = readDataItemRefs(option).filter((itemRef) => {
    const datumValue = resolveDatumFieldValue(itemRef.datum, field)
    return datumValue != null && valueSet.has(datumValue)
  })
  if (matchedRefs.length > 0) return matchedRefs

  return resolveDataItemRefsFromValues(values, option)
}

function parseHighlightKey(key) {
  if (typeof key !== 'string' || key.length === 0) return null
  const separatorIndex = key.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) return null
  return {
    field: key.slice(0, separatorIndex),
    value: key.slice(separatorIndex + 1),
  }
}

function resolveDataItemRefsFromHighlightKeys(highlightedKeys, option) {
  const itemRefs = readDataItemRefs(option)
  const directValueMatches = resolveDataItemRefsFromValues(highlightedKeys, option)
  const parsedPairs = (Array.isArray(highlightedKeys) ? highlightedKeys : [])
    .map((key) => parseHighlightKey(key))
    .filter(Boolean)

  if (parsedPairs.length === 0) return directValueMatches

  const pairMatches = itemRefs.filter((itemRef) => (
    parsedPairs.some(({ field, value }) => resolveDatumFieldValue(itemRef.datum, field) === String(value))
  ))
  return mergeDataItemRefs(directValueMatches, pairMatches)
}

function mergeDataItemRefs(...groups) {
  const merged = new Map()
  for (const group of groups) {
    for (const itemRef of Array.isArray(group) ? group : []) {
      const key = `${itemRef.seriesIndex}:${itemRef.dataIndex}`
      if (!merged.has(key)) {
        merged.set(key, itemRef)
      }
    }
  }
  return [...merged.values()]
}

function dispatchEChartsNativeActions({
  view,
  option,
  selection,
  highlightedKeys,
  viewport,
}) {
  if (typeof view?.dispatchAction !== 'function') return

  const selectedSeriesNames = resolveSeriesNamesFromSelection(selection, option)
  if (selectedSeriesNames.length > 0 && readSeriesNames(option).length > 0 && option?.legend) {
    const selectedSet = new Set(selectedSeriesNames)
    for (const name of readSeriesNames(option)) {
      view.dispatchAction({
        type: selectedSet.has(name) ? 'legendSelect' : 'legendUnSelect',
        name,
      })
    }
  }

  const highlightedSeriesNames = resolveSeriesNamesFromHighlights(highlightedKeys, option)
  if (highlightedSeriesNames.length > 0) {
    for (const name of readSeriesNames(option)) {
      view.dispatchAction({
        type: 'downplay',
        seriesName: name,
      })
    }
    for (const name of highlightedSeriesNames) {
      view.dispatchAction({
        type: 'highlight',
        seriesName: name,
      })
    }
  }

  const selectedItemRefs = selectedSeriesNames.length === 0
    ? resolveDataItemRefsFromSelection(selection, option)
    : []
  const highlightedItemRefs = resolveDataItemRefsFromHighlightKeys(highlightedKeys, option)
  const activeItemRefs = mergeDataItemRefs(selectedItemRefs, highlightedItemRefs)
  if (activeItemRefs.length > 0) {
    for (const itemRef of readDataItemRefs(option)) {
      view.dispatchAction({
        type: 'downplay',
        seriesIndex: itemRef.seriesIndex,
        dataIndex: itemRef.dataIndex,
      })
    }
    for (const itemRef of activeItemRefs) {
      view.dispatchAction({
        type: 'highlight',
        seriesIndex: itemRef.seriesIndex,
        dataIndex: itemRef.dataIndex,
      })
    }
  }

  for (const action of buildDataZoomActions(option, viewport)) {
    view.dispatchAction(action)
  }
}

function readSelectionFromOption(option) {
  if (!option?.widgetva || typeof option.widgetva !== 'object') return null
  if (option.widgetva.selection && typeof option.widgetva.selection === 'object') {
    return clone(option.widgetva.selection)
  }
  const selections = Object.values(option.widgetva.selections || {}).filter(Boolean)
  return clone(resolveRepresentativeSelection(selections))
}

function readSelectionFromCachedState(view) {
  const selections = Object.values(readCachedState(view)?.selections || {}).filter(Boolean)
  return clone(resolveRepresentativeSelection(selections))
}

function readAxisDomain(axis) {
  const axisObject = Array.isArray(axis) ? axis[0] : axis
  if (!axisObject || typeof axisObject !== 'object') return null
  if (!Number.isFinite(axisObject.min) || !Number.isFinite(axisObject.max)) return null
  return [axisObject.min, axisObject.max]
}

function readZoomDomain(dataZoom, axisKey) {
  const zoomItems = Array.isArray(dataZoom) ? dataZoom : (dataZoom ? [dataZoom] : [])
  const axisIndexKey = axisKey === 'x' ? 'xAxisIndex' : 'yAxisIndex'
  const candidate = zoomItems.find((zoomItem) => (
    zoomItem?.[axisIndexKey] != null
    && Number.isFinite(zoomItem.startValue)
    && Number.isFinite(zoomItem.endValue)
  )) || null
  if (!candidate) return null
  return [candidate.startValue, candidate.endValue]
}

function normalizeViewport(viewport) {
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) return null
  const normalized = {
    ...(Array.isArray(viewport.xDomain) ? { xDomain: clone(viewport.xDomain) } : {}),
    ...(Array.isArray(viewport.yDomain) ? { yDomain: clone(viewport.yDomain) } : {}),
    ...(viewport.zoom && typeof viewport.zoom === 'object' ? { zoom: clone(viewport.zoom) } : {}),
  }
  return Object.keys(normalized).length > 0 ? normalized : null
}

export function createEChartsWidgetAdapter(definition = {}) {
  return {
    provider: 'echarts',
    providerCapabilities: {
      supportedWidgetKinds: definition.kind ? [definition.kind] : [],
      renderStrategy: 'providerView',
      stateApplyStrategy: 'optionMerge',
      interactionBindingStrategy: 'providerEvents',
      supportsRendererMount: true,
      supportsRendererUpdate: true,
      supportsRendererDispose: true,
      supportsSignalPatching: false,
      supportsOptionMerging: true,
      supportsImperativeRender: false,
      supportsPointSelection: true,
      supportsIntervalSelection: true,
      supportsZoomPan: true,
      supportsSelectionReadback: true,
      supportsViewportReadback: true,
      supportsHighlightProjection: true,
      supportsInteractionEvents: true,
    },
    mount({ view = null, surface = null } = {}) {
      return { view, surface }
    },
    update({ view = null, surface = null } = {}) {
      return { view, surface }
    },
    dispose({ view = null } = {}) {
      return view?.dispose?.()
    },
    bindHumanInteractions(args = {}) {
      return bindEChartsFamilyInteractions(args)
    },
    async applyState(args) {
      const { view, state } = args || {}
      if (!view) return
      if (state && typeof state === 'object' && !Array.isArray(state)) {
        view.__widgetvaLastAppliedState = clone(state)
      }

      const selections = normalizeSelections(state)
      const selection = resolveRepresentativeSelection(selections)
      const intervalSelection = resolvePrimaryIntervalSelection(selections)
      const aggregateState = resolveAggregateStatePayload(state)
      const addRemoveState = resolveAddRemoveStatePayload(state)
      const drillDownState = resolveDrillDownStatePayload(state)
      const highlightState = resolveHighlightStatePayload(state)
      const focusPayload = resolveFocusPayload(state)
      const navigateState = resolveNavigateStatePayload(state)
      const reencodeState = resolveReencodeStatePayload(state)
      const sortPayload = resolveSortPayload(state)
      const highlightedKeys = Array.isArray(state?.feedback?.highlightedKeys) ? [...state.feedback.highlightedKeys] : []
      const viewport = resolveViewportFromState(state, intervalSelection)

      if (typeof view.setBrush === 'function') {
        view.setBrush(intervalSelection || null)
      }
      if (typeof view.setSelection === 'function') {
        view.setSelection(selection || null)
      }
      if (typeof view.setHighlights === 'function') {
        view.setHighlights(highlightedKeys)
      }
      if (highlightState && typeof view.setHighlightState === 'function') {
        view.setHighlightState(highlightState)
      }
      if (aggregateState && typeof view.setAggregateState === 'function') {
        view.setAggregateState(aggregateState)
      }
      if (addRemoveState && typeof view.setAddRemoveState === 'function') {
        view.setAddRemoveState(addRemoveState)
      }
      if (drillDownState && typeof view.setDrillDownState === 'function') {
        view.setDrillDownState(drillDownState)
      }
      if (focusPayload && typeof view.setFocus === 'function') {
        view.setFocus(focusPayload)
      }
      if (navigateState && typeof view.setNavigateState === 'function') {
        view.setNavigateState(navigateState)
      }
      if (reencodeState && typeof view.setReencodeState === 'function') {
        view.setReencodeState(reencodeState)
      }
      if (sortPayload && typeof view.setSort === 'function') {
        view.setSort(sortPayload)
      }
      if (viewport && typeof view.setViewport === 'function') {
        view.setViewport(viewport)
      } else if (viewport && typeof view.setDomain === 'function') {
        view.setDomain(
          Array.isArray(viewport.xDomain) ? viewport.xDomain : null,
          Array.isArray(viewport.yDomain) ? viewport.yDomain : null,
        )
      }

      if (typeof view.setOption !== 'function') return
      const nextOption = definition.buildOptionFromState?.(args) || null
      if (nextOption) {
        view.setOption(nextOption, { notMerge: false, lazyUpdate: true })
      }

      const currentOption = readCurrentOption(view)
      dispatchEChartsNativeActions({
        view,
        option: currentOption,
        selection,
        highlightedKeys,
        viewport,
      })
    },
    readSelection({ view } = {}) {
      if (typeof view?.getSelection === 'function') {
        return clone(view.getSelection() || null)
      }
      return readSelectionFromOption(readCurrentOption(view)) || readSelectionFromCachedState(view)
    },
    readViewport({ view } = {}) {
      if (typeof view?.getViewport === 'function') {
        return clone(view.getViewport() || null)
      }
      const option = readCurrentOption(view)
      const xDomain = readZoomDomain(option?.dataZoom, 'x') || readAxisDomain(option?.xAxis)
      const yDomain = readZoomDomain(option?.dataZoom, 'y') || readAxisDomain(option?.yAxis)
      if (Array.isArray(xDomain) || Array.isArray(yDomain)) {
        return {
          ...(Array.isArray(xDomain) ? { xDomain } : {}),
          ...(Array.isArray(yDomain) ? { yDomain } : {}),
        }
      }
      return normalizeViewport(readCachedState(view)?.view)
    },
    ...definition,
  }
}

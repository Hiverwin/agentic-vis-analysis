import { makeTransformState } from '../../../contracts/state-contracts.js'

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

function replaceActionTransform(transforms, actionName, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !(
    transform?.source === 'action'
    && transform?.spec?.actionName === actionName
  ))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function readCurrentWidgetState(currentState, targetWidget) {
  return currentState?.widgets?.[targetWidget.ref] || targetWidget || {}
}

function findFoldTransform(transforms = []) {
  return (Array.isArray(transforms) ? transforms : []).find((transform) => (
    transform && typeof transform === 'object' && Array.isArray(transform.fold)
  )) || null
}

function readDimensionOrderFromSpec(spec) {
  const representativeSpec = findRepresentativeParallelCoordinatesSpec(spec) || spec
  const sort = representativeSpec?.encoding?.x?.sort
  if (Array.isArray(sort) && sort.length > 0) return sort.filter((dimension) => typeof dimension === 'string')
  const domain = representativeSpec?.encoding?.x?.scale?.domain
  if (Array.isArray(domain) && domain.length > 0) return domain.filter((dimension) => typeof dimension === 'string')
  const fold = findFoldTransform(representativeSpec?.transform)
  if (Array.isArray(fold?.fold) && fold.fold.length > 0) return fold.fold.filter((dimension) => typeof dimension === 'string')
  return []
}

function readParallelDimensionOrder(currentWidgetState, targetWidget) {
  const viewOrder = currentWidgetState?.view?.reencode?.dimensionOrder
    || currentWidgetState?.view?.reencode?.dimensions
    || currentWidgetState?.view?.dimensionVisibility?.visibleDimensions
  if (Array.isArray(viewOrder) && viewOrder.length > 0) {
    return viewOrder.filter((dimension) => typeof dimension === 'string')
  }
  return readDimensionOrderFromSpec(
    currentWidgetState?.currentSpec
      || currentWidgetState?.rawSpec
      || targetWidget?.currentSpec
      || targetWidget?.rawSpec
      || null,
  )
}

export function buildParallelReorderPatch({ targetWidget, currentState, dimensionOrder }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'parallelCoordinates.reorderDimensions'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'reencode',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            dimensionOrder,
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          dimensionOrder: {
            sourceAction: actionName,
            dimensionOrder,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'dimensionOrder',
          sourceAction: actionName,
          dimensionOrder,
        },
      },
    },
  }
}

export function buildParallelHighlightPatch({ targetWidget, currentState, field, values }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'parallelCoordinates.highlightCategory'
  return {
    [targetWidget.ref]: {
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          highlight: {
            sourceAction: actionName,
            field,
            values,
            predicates: [{ field, op: 'in', value: values }],
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        highlight: {
          mode: 'categoryEmphasis',
          sourceAction: actionName,
          field,
          values,
        },
      },
    },
  }
}

export function buildParallelDimensionVisibilityPatch({ targetWidget, currentState, dimensions, mode }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'parallelCoordinates.hideDimensions'
  const previousVisibility = currentWidgetState?.view?.dimensionVisibility
    || currentWidgetState?.data?.analysis?.dimensionVisibility
    || {}
  const allDimensions = Array.isArray(previousVisibility.allDimensions) && previousVisibility.allDimensions.length > 0
    ? previousVisibility.allDimensions
    : readParallelDimensionOrder(currentWidgetState, targetWidget)
  const previousHidden = new Set(Array.isArray(previousVisibility.hiddenDimensions) ? previousVisibility.hiddenDimensions : [])
  for (const dimension of dimensions) {
    if (mode === 'show') previousHidden.delete(dimension)
    else previousHidden.add(dimension)
  }
  const hiddenDimensions = allDimensions.filter((dimension) => previousHidden.has(dimension))
  const visibleDimensions = allDimensions.filter((dimension) => !previousHidden.has(dimension))
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'filter',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            operation: mode,
            dimensions,
            hiddenDimensions,
            visibleDimensions,
            allDimensions,
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          dimensionVisibility: {
            sourceAction: actionName,
            operation: mode,
            dimensions,
            hiddenDimensions,
            visibleDimensions,
            allDimensions,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        dimensionVisibility: {
          mode: 'dimensionVisibility',
          sourceAction: actionName,
          operation: mode,
          dimensions,
          hiddenDimensions,
          visibleDimensions,
          allDimensions,
        },
        reencode: {
          mode: 'dimensionVisibility',
          sourceAction: actionName,
          operation: mode,
          hiddenDimensions,
          visibleDimensions,
        },
      },
    },
  }
}

export function buildParallelResetHiddenDimensionsPatch({ targetWidget, currentState }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'parallelCoordinates.resetHiddenDimensions'
  const previousVisibility = currentWidgetState?.view?.dimensionVisibility
    || currentWidgetState?.data?.analysis?.dimensionVisibility
    || {}
  const allDimensions = Array.isArray(previousVisibility.allDimensions) && previousVisibility.allDimensions.length > 0
    ? previousVisibility.allDimensions
    : readParallelDimensionOrder(currentWidgetState, targetWidget)
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        'parallelCoordinates.hideDimensions',
        null,
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          dimensionVisibility: {
            sourceAction: actionName,
            operation: 'reset',
            dimensions: [],
            hiddenDimensions: [],
            visibleDimensions: allDimensions,
            allDimensions,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        dimensionVisibility: {
          mode: 'dimensionVisibility',
          sourceAction: actionName,
          operation: 'reset',
          dimensions: [],
          hiddenDimensions: [],
          visibleDimensions: allDimensions,
          allDimensions,
        },
        reencode: {
          mode: 'dimensionVisibility',
          sourceAction: actionName,
          operation: 'reset',
          hiddenDimensions: [],
          visibleDimensions: allDimensions,
        },
      },
    },
  }
}

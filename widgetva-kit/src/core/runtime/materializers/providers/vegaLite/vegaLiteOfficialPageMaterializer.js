import { applySelectionToSpec } from '../../state/widgetStateBuilders.js'
import {
  buildRuntimeDataProjectionSpec,
  findFirstContinuousXYEncoding,
  hasCompositeChildren,
  hasRuntimeDataProjection,
  isCompositeDataMaterializingSelection,
  normalizeWidgetSelections,
  resolveSelectionMaterialization,
  rowMatchesCompositeSelection,
} from './vegaLiteDataProjection.js'
import {
  collectScaleBoundParamNames,
  injectParamValuesIntoSpec,
  normalizeSelectionMap,
  readSelectionId,
  rewriteSpecForParamSelections,
} from './vegaLiteSelectionProjection.js'
import {
  applyVegaLiteAddRemoveState,
  applyVegaLiteEmphasisState,
  applyVegaLiteFilterState,
  applyVegaLiteReencodeState,
  applyVegaLiteViewState,
} from './vegaLiteStateProjection.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function applyPostSelectionViewState(spec, state = {}) {
  let nextSpec = applyVegaLiteAddRemoveState(spec, state?.view?.addRemove)
  nextSpec = applyVegaLiteEmphasisState(nextSpec, state?.view?.highlight)
  return nextSpec
}

export function createOfficialPageMaterializer({
  root,
  capture = null,
  currentSpecRef,
  renderedSpecRef,
  viewRef,
}) {
  const source = capture?.source || null
  const target = capture?.target || null
  const options = capture?.options

  if (source === 'embedExample' && typeof root?.embedExample === 'function' && target != null) {
    return async function rematerializeThroughEmbedExample(nextSpecOverride = null, options = {}) {
      const force = options?.force === true
      const nextSpec = clone(nextSpecOverride || currentSpecRef.current)
      if (!force && deepEqual(renderedSpecRef.current, nextSpec)) {
        return viewRef.current
      }

      const previousView = viewRef.current
      const nextView = await root.embedExample(target, nextSpec, options)
      viewRef.current = nextView || previousView
      renderedSpecRef.current = clone(nextSpec)
      if (previousView && previousView !== nextView) {
        try {
          previousView.finalize?.()
        } catch {}
      }
      return viewRef.current
    }
  }

  if (source === 'vegaEmbed' && typeof root?.vegaEmbed === 'function' && target != null) {
    return async function rematerializeThroughVegaEmbed(nextSpecOverride = null, options = {}) {
      const force = options?.force === true
      const nextSpec = clone(nextSpecOverride || currentSpecRef.current)
      if (!force && deepEqual(renderedSpecRef.current, nextSpec)) {
        return viewRef.current
      }

      const previousView = viewRef.current
      const result = await root.vegaEmbed(target, nextSpec, options)
      const nextView = result?.view || previousView
      viewRef.current = nextView
      renderedSpecRef.current = clone(nextSpec)
      if (previousView && previousView !== nextView) {
        try {
          previousView.finalize?.()
        } catch {}
      }
      return viewRef.current
    }
  }

  return async function noOpMaterialize(nextSpecOverride = null) {
    const nextSpec = clone(nextSpecOverride || currentSpecRef.current)
    renderedSpecRef.current = clone(nextSpec)
    return viewRef.current
  }
}


export function buildVegaLiteRenderSpecFromRuntimeState({
  semanticSpec,
  state,
  runtime,
}) {
  let baseSpec = clone(semanticSpec)
  baseSpec = hasRuntimeDataProjection(state)
    ? buildRuntimeDataProjectionSpec({ semanticSpec: baseSpec, state, runtime }) || baseSpec
    : baseSpec
  baseSpec = applyVegaLiteFilterState(baseSpec, state?.transforms)
  baseSpec = applyVegaLiteViewState(baseSpec, state?.view)
  baseSpec = applyVegaLiteReencodeState(baseSpec, state?.view?.reencode)
  const activeSelections = normalizeWidgetSelections(state)
  if (!baseSpec) {
    return baseSpec
  }
  if (activeSelections.length === 0) {
    return applyPostSelectionViewState(baseSpec, state)
  }

  const selectionMap = normalizeSelectionMap(activeSelections)
  const consumedSelectionIds = new Set()
  const paramValueInjectedSpec = injectParamValuesIntoSpec(baseSpec, selectionMap, consumedSelectionIds)
  const remainingSelections = activeSelections.filter((selection) => {
    const selectionId = readSelectionId(selection)
    return !selectionId || !consumedSelectionIds.has(selectionId)
  })
  if (remainingSelections.length === 0) {
    return applyPostSelectionViewState(paramValueInjectedSpec, state)
  }

  const scaleBoundParamNames = collectScaleBoundParamNames(paramValueInjectedSpec)
  const paramRewrittenSpec = rewriteSpecForParamSelections(paramValueInjectedSpec, selectionMap, scaleBoundParamNames, consumedSelectionIds)
  const finalRemainingSelections = activeSelections.filter((selection) => {
    const selectionId = readSelectionId(selection)
    return !selectionId || !consumedSelectionIds.has(selectionId)
  })

  const compositeSelections = hasCompositeChildren(paramRewrittenSpec)
    ? finalRemainingSelections.filter(isCompositeDataMaterializingSelection)
    : finalRemainingSelections
  if (hasCompositeChildren(paramRewrittenSpec) && compositeSelections.length === 0) {
    const projectedSpec = buildRuntimeDataProjectionSpec({
      semanticSpec: paramRewrittenSpec,
      state,
      runtime,
    }) || paramRewrittenSpec
    return applyPostSelectionViewState(applySelectionToSpec({
      widgetSpec: projectedSpec,
      activeSelections: finalRemainingSelections,
      selectionEnabled: true,
    }), state)
  }

  const materialization = resolveSelectionMaterialization({
    semanticSpec: paramRewrittenSpec,
    state,
    runtime,
  })
  const rows = materialization?.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return applyPostSelectionViewState(paramRewrittenSpec, state)
  }

  const nextSpec = buildRuntimeDataProjectionSpec({
    semanticSpec: paramRewrittenSpec,
    state,
    runtime,
  }) || paramRewrittenSpec

  if (hasCompositeChildren(paramRewrittenSpec)) {
    const encoding = findFirstContinuousXYEncoding(paramRewrittenSpec)
    nextSpec.data = {
      values: rows.filter((row) => rowMatchesCompositeSelection(row, compositeSelections, encoding)),
    }
    return applyPostSelectionViewState(nextSpec, state)
  }

  return applyPostSelectionViewState(applySelectionToSpec({
    widgetSpec: nextSpec,
    activeSelections: finalRemainingSelections,
    selectionEnabled: true,
  }), state)
}

export const buildOfficialPageRenderSpec = buildVegaLiteRenderSpecFromRuntimeState

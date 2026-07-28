import { makeTransformState } from '../../../contracts/state-contracts.js'

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

export function buildSankeySemanticPatch({
  targetWidget,
  currentState,
  actionName,
  transformKind = 'derive',
  analysisKey,
  viewKey,
  viewState,
  spec,
  clearActionName = null,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const nextTransforms = replaceActionTransform(
    currentWidgetState.transforms,
    clearActionName || actionName,
    clearActionName
      ? null
      : makeTransformState({
          kind: transformKind,
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            ...(spec || {}),
          },
        }),
  )

  return {
    [targetWidget.ref]: {
      transforms: nextTransforms,
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          [analysisKey]: {
            sourceAction: actionName,
            ...(spec || {}),
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        [viewKey]: {
          sourceAction: actionName,
          ...(viewState || spec || {}),
        },
      },
    },
  }
}

import { makeTransformState } from '../../../contracts/state-contracts.js'

function replaceActionTransform(transforms, actionName, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !(
    transform?.source === 'action'
    && transform?.spec?.actionName === actionName
  ))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

export function readCurrentWidgetState(currentState, targetWidget) {
  return currentState?.widgets?.[targetWidget.ref] || targetWidget || {}
}

export function buildHeatmapSemanticPatch({
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
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
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
      ),
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
        [viewKey]: viewState === null
          ? null
          : {
              sourceAction: actionName,
              ...(viewState || spec || {}),
            },
      },
    },
  }
}

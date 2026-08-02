import { makeTransformState } from '../../../contracts/state-contracts.js'

function replaceActionTransform(transforms, actionName, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !(
    transform?.source === 'action'
    && transform?.spec?.actionName === actionName
  ))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

export function buildWidgetAggregatePatch({ targetWidget, groupBy, measures }) {
  const actionName = 'widget.aggregateData'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        targetWidget?.transforms,
        actionName,
        makeTransformState({
          kind: 'aggregate',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            groupBy,
            measures,
          },
        }),
      ),
      view: {
        ...(targetWidget?.view || {}),
        aggregate: {
          sourceAction: actionName,
          groupBy,
          measures,
        },
      },
    },
  }
}

export function buildWidgetChangeEncodingPatch({ targetWidget, channel, field, type, aggregate }) {
  return {
    [targetWidget.ref]: {
      encodings: {
        ...(targetWidget?.encodings || {}),
        [channel]: {
          ...(targetWidget?.encodings?.[channel] || {}),
          field,
          ...(type ? { type } : {}),
          ...(aggregate ? { aggregate } : {}),
        },
      },
    },
  }
}

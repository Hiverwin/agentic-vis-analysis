import { makeTransformState } from '../../../contracts/state-contracts.js'
import { buildViewZoomState } from '../../../core/runtime/materializers/state/viewStateMetadata.js'
import { deriveHighlightState, withHighlightSubmodel } from '../../../workspace/state/highlightStateModel.js'
import { buildWidgetFilterPatch } from './filterPatch.js'

function replaceActionTransform(transforms, actionName, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !(
    transform?.source === 'action'
    && transform?.spec?.actionName === actionName
  ))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

function replaceActionHighlightTransformForField(transforms, field, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !(
    transform?.kind === 'highlight'
    && transform?.source === 'action:widget.highlightValues'
    && transform?.spec?.field === field
  ))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

export function uniqueWidgetValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

export function buildWidgetFilterByValuesPatch({ targetWidget, currentState, field, values, visibleCount }) {
  return buildWidgetFilterPatch({
    targetWidget,
    currentState,
    actionName: 'widget.filterByValues',
    field,
    values,
    predicates: [{ field, op: 'in', value: values }],
    visibleCount,
  })
}

export function buildWidgetFilterByRangePatch({ targetWidget, currentState, field, range, visibleCount }) {
  return buildWidgetFilterPatch({
    targetWidget,
    currentState,
    actionName: 'widget.filterByRange',
    field,
    range,
    predicates: [{ field, op: 'between', value: range }],
    visibleCount,
  })
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

export function buildWidgetSortEncodingPatch({ targetWidget, channel, order, field, aggregate }) {
  return {
    [targetWidget.ref]: {
      view: {
        ...(targetWidget?.view || {}),
        sort: {
          sourceAction: 'widget.sortEncoding',
          channel,
          mode: 'direction',
          order,
          ...(field ? { field } : {}),
          ...(aggregate ? { aggregate } : {}),
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

export function buildWidgetHighlightValuesPatch({ targetWidget, currentState, field, values, rows }) {
  const targetWidgetRef = targetWidget?.ref || null
  const targetWidgetState = currentState?.widgets?.[targetWidgetRef] || targetWidget || {}
  const highlightedValues = uniqueWidgetValues(values)
  const highlightedCount = (Array.isArray(rows) ? rows : []).filter((row) => highlightedValues.includes(row?.[field])).length
  const widgetPatch = {
    transforms: replaceActionHighlightTransformForField(
      targetWidgetState?.transforms,
      field,
      makeTransformState({
        kind: 'highlight',
        source: 'action:widget.highlightValues',
        spec: {
          field,
          values: highlightedValues,
        },
      }),
    ),
    feedback: {
      ...(targetWidgetState?.feedback || {}),
      highlightedKeys: highlightedValues,
    },
  }
  const nextState = {
    ...currentState,
    widgets: {
      ...(currentState?.widgets || {}),
      [targetWidgetRef]: {
        ...(targetWidgetState || {}),
        ...widgetPatch,
      },
    },
  }

  return {
    patch: {
      [targetWidgetRef]: widgetPatch,
      shared: withHighlightSubmodel(currentState?.shared || {}, deriveHighlightState(nextState)),
    },
    highlightedCount,
  }
}

export function buildWidgetZoomDomainPatch({ targetWidget, xDomain, yDomain }) {
  return {
    [targetWidget.ref]: {
      view: {
        ...(targetWidget?.view || {}),
        ...(xDomain ? { xDomain } : {}),
        ...(yDomain ? { yDomain } : {}),
        zoom: buildViewZoomState({
          widgetSpec: targetWidget.rawSpec || targetWidget.currentSpec,
          xDomain,
          yDomain,
        }),
      },
    },
  }
}

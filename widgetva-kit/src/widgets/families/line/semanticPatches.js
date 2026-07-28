import { makeTransformState } from '../../../contracts/state-contracts.js'
import { buildViewZoomState } from '../../../core/runtime/materializers/state/viewStateMetadata.js'
import { buildWidgetSelectionPatch } from '../shared/selectionPatch.js'
import { buildWidgetViewPatch } from '../shared/viewPatch.js'

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

export function buildLineSeriesSelectionPatch({
  targetWidget,
  currentState,
  field,
  values,
  selectedCount,
  selectionId = `sel_${Date.now()}`,
}) {
  return buildWidgetSelectionPatch({
    targetWidget,
    currentState,
    selection: {
      selection_id: selectionId,
      source_widget_id: targetWidget.widgetId || undefined,
      selection_type: 'category',
      field,
      values,
      predicates: [{ field, op: 'in', value: values }],
      count: selectedCount,
      summary: `${field}: ${values.join(', ')}`,
    },
  })
}

export function buildLineZoomXRegionPatch({ targetWidget, start, end }) {
  return buildWidgetViewPatch({
    targetWidget,
    view: {
      xDomain: [start, end],
      zoom: {
        ...(buildViewZoomState({
          widgetSpec: targetWidget.rawSpec || targetWidget.currentSpec,
          xDomain: [start, end],
        }) || {}),
        sourceAction: 'line.zoomXRegion',
        start,
        end,
      },
    },
  })
}

export function buildLineTrendPatch({ targetWidget, currentState, trendType, xField, yField }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.highlightTrend'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'derive',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            trendType,
            fields: [xField, yField],
            overlay: 'regression',
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          trend: {
            sourceAction: actionName,
            trendType,
            xField,
            yField,
            overlay: 'regression',
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'regressionOverlay',
          sourceAction: actionName,
          method: trendType,
          xField,
          yField,
        },
      },
    },
  }
}

export function buildLineMovingAveragePatch({ targetWidget, currentState, windowSize, xField, yField, groupBy }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.showMovingAverage'
  const outputField = '__widgetva_moving_average'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'derive',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            windowSize,
            fields: [xField, yField],
            outputField,
            ...(groupBy ? { groupBy: [groupBy] } : {}),
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          movingAverage: {
            sourceAction: actionName,
            windowSize,
            xField,
            yField,
            outputField,
            ...(groupBy ? { groupBy: [groupBy] } : {}),
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        addRemove: {
          mode: 'movingAverageOverlay',
          sourceAction: actionName,
          windowSize,
          xField,
          yField,
          outputField,
          ...(groupBy ? { groupBy: [groupBy] } : {}),
        },
      },
    },
  }
}

export function buildLineDrillDownPatch({
  targetWidget,
  currentState,
  level,
  value,
  parent,
  rawTimeField,
  rawValueField,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.drillDownXAxis'
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
            level,
            value,
            parent,
            field: rawTimeField,
            predicates: [{ field: rawTimeField, op: 'timeUnitEquals', value, level }],
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          drillDown: {
            sourceAction: actionName,
            level,
            value,
            parent,
            rawTimeField,
            rawValueField,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        drillDown: {
          sourceAction: actionName,
          level,
          value,
          parent,
          rawTimeField,
          rawValueField,
        },
      },
    },
  }
}

export function buildLineResetDrillDownPatch({ targetWidget, currentState }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.drillDownXAxis'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(currentWidgetState.transforms, actionName, null),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          drillDown: null,
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        drillDown: null,
      },
    },
  }
}

export function buildLineResamplePatch({
  targetWidget,
  currentState,
  granularity,
  timeUnit,
  agg,
  rawTimeField,
  rawValueField,
  groupBy,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.resampleXAxis'
  const timeField = `${granularity}_${rawTimeField}`
  const valueField = `${agg}_${rawValueField}`
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'aggregate',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            granularity,
            timeUnit,
            agg,
            rawTimeField,
            rawValueField,
            timeField,
            valueField,
            ...(groupBy ? { groupBy: [groupBy] } : {}),
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          resample: {
            sourceAction: actionName,
            granularity,
            timeUnit,
            agg,
            rawTimeField,
            rawValueField,
            timeField,
            valueField,
            ...(groupBy ? { groupBy: [groupBy] } : {}),
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'resample',
          sourceAction: actionName,
          granularity,
          timeUnit,
          agg,
          rawTimeField,
          rawValueField,
          timeField,
          valueField,
          ...(groupBy ? { groupBy: [groupBy] } : {}),
        },
      },
    },
  }
}

export function buildLineResetResamplePatch({ targetWidget, currentState }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.resampleXAxis'
  const currentReencode = currentWidgetState.view?.reencode || null
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(currentWidgetState.transforms, actionName, null),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          resample: null,
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: currentReencode?.sourceAction === actionName ? null : currentReencode,
      },
    },
  }
}

export function buildLineBoldPatch({
  targetWidget,
  currentState,
  lineField,
  lineNames,
  boldWidth,
  baseWidth,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.boldLines'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'derive',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            field: lineField,
            values: lineNames,
            boldWidth,
            baseWidth,
          },
        }),
      ),
      view: {
        ...(currentWidgetState.view || {}),
        highlight: {
          sourceAction: actionName,
          mode: 'seriesEmphasis',
          lineField,
          lineNames,
          boldWidth,
          baseWidth,
        },
      },
    },
  }
}

export function buildLineFilterPatch({
  targetWidget,
  currentState,
  lineField,
  linesToRemove,
  visibleCount,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'line.filterLines'
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
            field: lineField,
            values: linesToRemove,
            predicates: [{ field: lineField, op: 'notIn', value: linesToRemove }],
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        ...(Number.isFinite(visibleCount) ? { visibleCount } : {}),
      },
    },
  }
}

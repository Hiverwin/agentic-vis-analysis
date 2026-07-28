import { makeTransformState } from '../../../contracts/state-contracts.js'
import { buildViewZoomState } from '../../../core/runtime/materializers/state/viewStateMetadata.js'
import { buildWidgetFilterPatch } from '../shared/filterPatch.js'
import { buildWidgetSelectionPatch } from '../shared/selectionPatch.js'

function replaceActionTransform(transforms, actionName, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  return [
    ...safeTransforms.filter((transform) => !(
      transform?.source === 'action'
      && transform?.spec?.actionName === actionName
    )),
    nextTransform,
  ]
}

export function buildScatterRegionSelectionPatch({
  targetWidget,
  currentState,
  selectionId,
  xField,
  yField,
  xRange,
  yRange,
  selectedCount,
  tag,
}) {
  const [xMin, xMax] = [Math.min(...xRange), Math.max(...xRange)]
  const [yMin, yMax] = [Math.min(...yRange), Math.max(...yRange)]

  return buildWidgetSelectionPatch({
    targetWidget,
    currentState,
    selection: {
      selection_id: selectionId,
      source_widget_id: targetWidget.widgetId || undefined,
      selection_type: 'interval',
      fields: [xField, yField],
      value: {
        [xField]: [xMin, xMax],
        [yField]: [yMin, yMax],
      },
      domain: {
        xDomain: [xMin, xMax],
        yDomain: [yMin, yMax],
      },
      predicates: [
        { field: xField, op: 'between', value: [xMin, xMax] },
        { field: yField, op: 'between', value: [yMin, yMax] },
      ],
      count: selectedCount,
      summary: `${xField} ${xMin}~${xMax}; ${yField} ${yMin}~${yMax}`,
      ...(tag ? { tag } : {}),
    },
  })
}

export function buildScatterZoomDomainPatch({ targetWidget, xDomain, yDomain }) {
  return {
    [targetWidget.ref]: {
      view: {
        ...(targetWidget.view || {}),
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

export function buildScatterCategoricalFilterPatch({
  targetWidget,
  currentState,
  field,
  categoriesToRemove,
  visibleCount,
}) {
  return buildWidgetFilterPatch({
    targetWidget,
    currentState,
    actionName: 'scatter.filterCategorical',
    field,
    values: categoriesToRemove,
    predicates: [{ field, op: 'notIn', value: categoriesToRemove }],
    visibleCount,
  })
}

export function buildScatterClusterAnalysisPatch({
  targetWidget,
  currentState,
  method,
  nClusters,
  clusterField,
  clusterStatistics,
  labels,
  annotatedRows,
  xField,
  yField,
}) {
  const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget || {}
  const actionName = 'scatter.identifyClusters'
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
            method,
            nClusters,
            clusterField,
            fields: [xField, yField],
            clusterStatistics,
            labels,
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          clusters: {
            sourceAction: actionName,
            method,
            nClusters,
            clusterField,
            clusterStatistics,
          },
        },
        derivedRows: annotatedRows,
      },
      encodings: {
        ...(currentWidgetState.encodings || {}),
        color: {
          ...(currentWidgetState.encodings?.color || {}),
          field: clusterField,
          type: 'nominal',
          sourceAction: actionName,
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'clusterEncoding',
          sourceAction: actionName,
          method,
          clusterField,
          nClusters,
        },
      },
    },
  }
}

export function buildScatterRegressionOverlayPatch({
  targetWidget,
  currentState,
  method,
  xField,
  yField,
  regression,
}) {
  const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget || {}
  const actionName = 'scatter.showRegression'
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
            method,
            fields: [xField, yField],
            slope: regression.slope,
            intercept: regression.intercept,
            domain: regression.domain,
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          regression: {
            sourceAction: actionName,
            method,
            xField,
            yField,
            slope: regression.slope,
            intercept: regression.intercept,
            domain: regression.domain,
            points: regression.points,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'regressionOverlay',
          sourceAction: actionName,
          method,
          xField,
          yField,
          slope: regression.slope,
          intercept: regression.intercept,
          domain: regression.domain,
          points: regression.points,
        },
      },
    },
  }
}

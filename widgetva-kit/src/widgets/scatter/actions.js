import { makeActionDescriptor, makeFilterEffect, makeSelectionEffect } from '../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../../adapters/widgets/shared/selectionResult.js'

const SCATTER_BRUSH_TAG = 'scatter.brushRegion'

function replaceTaggedLayer(layers, tag, nextLayer) {
  const safeLayers = Array.isArray(layers) ? layers : []
  const nextLayers = safeLayers.filter((layer) => layer?._widgetvaTag !== tag)
  return nextLayer ? [...nextLayers, nextLayer] : nextLayers
}

function isScatterPointMark(mark) {
  const type = typeof mark === 'string' ? mark : mark?.type
  return !type || type === 'point' || type === 'circle' || type === 'square'
}

function buildDatumBetweenTest(field, min, max) {
  return `datum[${JSON.stringify(field)}] >= ${min} && datum[${JSON.stringify(field)}] <= ${max}`
}

function withBrushOpacity(layer, { xField, yField, xMin, xMax, yMin, yMax }) {
  const encoding = layer?.encoding || {}
  const inBrushTest = [
    buildDatumBetweenTest(xField, xMin, xMax),
    buildDatumBetweenTest(yField, yMin, yMax),
  ].join(' && ')

  return {
    ...layer,
    encoding: {
      ...encoding,
      opacity: {
        condition: {
          test: inBrushTest,
          value: 1,
        },
        value: 0.68,
      },
    },
  }
}

function applyBrushVisualToSpec(spec, brush) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('No active base spec is available for scatter brush visuals.')
  }

  if (Array.isArray(spec.layer) && spec.layer.length > 0) {
    let applied = false
    const visualLayers = spec.layer
      .filter((layer) => layer?._widgetvaTag !== SCATTER_BRUSH_TAG)
      .map((layer) => {
        if (!applied && !layer?._widgetvaTag && isScatterPointMark(layer?.mark)) {
          applied = true
          return withBrushOpacity(layer, brush)
        }
        return layer
      })
    return {
      ...spec,
      layer: visualLayers,
      _scatter_brush_state: {
        fields: [brush.xField, brush.yField],
        xRange: [brush.xMin, brush.xMax],
        yRange: [brush.yMin, brush.yMax],
      },
    }
  }

  return {
    ...spec,
    encoding: withBrushOpacity({ encoding: spec.encoding || {} }, brush).encoding,
    _scatter_brush_state: {
      fields: [brush.xField, brush.yField],
      xRange: [brush.xMin, brush.xMax],
      yRange: [brush.yMin, brush.yMax],
    },
  }
}

function euclideanDistanceSquared(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return (dx * dx) + (dy * dy)
}

function assignPointsToCenters(points, centers) {
  return points.map((point) => {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    centers.forEach((center, index) => {
      const distance = euclideanDistanceSquared(point, center)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    return bestIndex
  })
}

function recomputeCenters(points, labels, clusterCount, previousCenters) {
  return Array.from({ length: clusterCount }, (_, clusterIndex) => {
    const clusterPoints = points.filter((_, pointIndex) => labels[pointIndex] === clusterIndex)
    if (!clusterPoints.length) {
      return previousCenters[clusterIndex]
    }
    const sums = clusterPoints.reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
      [0, 0],
    )
    return [sums[0] / clusterPoints.length, sums[1] / clusterPoints.length]
  })
}

function runKMeans(points, clusterCount, maxIterations = 25) {
  const safeClusterCount = Math.max(1, Math.min(clusterCount, points.length))
  let centers = points.slice(0, safeClusterCount).map((point) => [...point])
  let labels = assignPointsToCenters(points, centers)

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const nextCenters = recomputeCenters(points, labels, safeClusterCount, centers)
    const nextLabels = assignPointsToCenters(points, nextCenters)
    const unchanged = nextLabels.every((label, index) => label === labels[index])
    centers = nextCenters
    labels = nextLabels
    if (unchanged) break
  }

  return { labels, centers }
}

function hasInlineObjectRows(spec) {
  return Array.isArray(spec?.data?.values)
    && spec.data.values.some((row) => row && typeof row === 'object')
}

function isUrlBackedDataSpec(spec) {
  return typeof spec?.data?.url === 'string' && spec.data.url.trim().length > 0
}

export function buildScatterActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['scatter']
  return [
    makeActionDescriptor({
      name: 'scatter.brushRegion',
      title: 'Brush scatterplot region',
      description: 'Select points inside a data-space rectangle on the scatterplot.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          xField: { type: 'string' },
          yField: { type: 'string' },
          xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        },
        required: ['xField', 'yField', 'xRange', 'yRange'],
      },
      postconditions: [
        {
          description: 'The active selection should contain an interval over the x and y fields.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid scatter widget in the current workspace.',
          failureMessage: 'scatter.brushRegion requires a valid scatter target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates an interval selection on the scatterplot.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeFilterEffect(ref, 'Linked widgets may be filtered or highlighted by the scatter selection.')),
      ],
      examples: [
        {
          userGoal: 'Brush a region of interest in the scatterplot.',
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
            xRange: [80, 160],
            yRange: [20, 35],
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'scatter.zoomDomain',
      title: 'Zoom scatterplot domain',
      description: 'Zoom the scatterplot to a specific x and/or y domain.',
      primitive: 'zoom',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'transforms')),
      paramsSchema: {
        type: 'object',
        properties: {
          xDomain: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }],
            },
          },
          yDomain: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }],
            },
          },
        },
      },
      postconditions: [
        {
          description: 'The scatterplot view should reflect the requested x and/or y domain.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid scatter widget in the current workspace.',
          failureMessage: 'scatter.zoomDomain requires a valid scatter target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Zoom into the high-risk cluster region of the scatterplot.',
          params: {
            xDomain: [80, 160],
            yDomain: [20, 35],
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'scatter.identifyClusters',
      title: 'Identify scatter clusters',
      description: 'Cluster visible scatter points in the frontend and recolor the scatterplot by the derived cluster labels.',
      primitive: 'annotate',
      category: 'compute',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          nClusters: { type: 'number' },
          method: { type: 'string' },
        },
      },
      postconditions: [
        {
          description: 'The scatterplot data should include a derived cluster field and the color encoding should point to it.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid scatter widget with quantitative x/y encodings and enough visible rows.',
          failureMessage: 'scatter.identifyClusters requires a valid scatter target widget with enough visible numeric points.',
        },
      ],
      examples: [
        {
          userGoal: 'Color the visible scatter points by their inferred clusters.',
          params: { nClusters: 3, method: 'kmeans' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'scatter.showRegression',
      title: 'Overlay scatter regression',
      description: 'Add or replace a regression-line overlay on the current scatterplot using the active x/y encodings.',
      primitive: 'annotate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          method: { type: 'string' },
        },
      },
      postconditions: [
        {
          description: 'A tagged regression overlay layer should be present and should use the current scatter x/y fields.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid scatter widget in the current workspace.',
          failureMessage: 'scatter.showRegression requires a valid scatter target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Overlay a regression line on the scatterplot to inspect the overall trend.',
          params: { method: 'linear' },
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerScatterActions(actionExecutor) {
  if (!actionExecutor.has('scatter.brushRegion')) {
    actionExecutor.register(
      { name: 'scatter.brushRegion' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'scatter',
        })
        const xRange = Array.isArray(params.xRange) ? params.xRange : null
        const yRange = Array.isArray(params.yRange) ? params.yRange : null
        if (!targetWidget || !params.xField || !params.yField || !xRange || !yRange) {
          throw new Error('scatter.brushRegion requires a scatter target, xField, yField, xRange, and yRange.')
        }

        const { rows } = ctx.readRowsForWidget(targetWidget.ref)
        const [xMin, xMax] = [Math.min(...xRange), Math.max(...xRange)]
        const [yMin, yMax] = [Math.min(...yRange), Math.max(...yRange)]
        const filtered = rows.filter((row) => {
          const x = row?.[params.xField]
          const y = row?.[params.yField]
          return typeof x === 'number' && typeof y === 'number' && x >= xMin && x <= xMax && y >= yMin && y <= yMax
        })

        ctx.updateCurrentSpec((spec) => applyBrushVisualToSpec(spec, {
          xField: params.xField,
          yField: params.yField,
          xMin,
          xMax,
          yMin,
          yMax,
        }))
        const nextState = ctx.commitSelection({
          selection_id: 'brush',
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'interval',
          fields: [params.xField, params.yField],
          value: {
            [params.xField]: [xMin, xMax],
            [params.yField]: [yMin, yMax],
          },
          domain: {
            xDomain: [xMin, xMax],
            yDomain: [yMin, yMax],
          },
          predicates: [
            { field: params.xField, op: 'between', value: [xMin, xMax] },
            { field: params.yField, op: 'between', value: [yMin, yMax] },
          ],
          count: filtered.length,
          summary: `${params.xField} ${xMin}~${xMax}; ${params.yField} ${yMin}~${yMax}`,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: filtered.length,
          verificationHints: [
            'Read the updated widget selection state.',
            'Call perception.summarizeSelection to confirm the selected count.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('scatter.zoomDomain')) {
    actionExecutor.register(
      { name: 'scatter.zoomDomain' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'scatter',
          message: 'scatter.zoomDomain requires a valid scatter target widget.',
        })
        const xDomain = Array.isArray(params.xDomain) ? params.xDomain : null
        const yDomain = Array.isArray(params.yDomain) ? params.yDomain : null
        if (!targetWidget || (!xDomain && !yDomain)) {
          throw new Error('scatter.zoomDomain requires a scatter target and at least one domain range.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for scatter domain updates.')
          }

          const nextEncoding = { ...(spec.encoding || {}) }
          if (xDomain && nextEncoding.x) {
            nextEncoding.x = {
              ...nextEncoding.x,
              scale: {
                ...(nextEncoding.x.scale || {}),
                domain: xDomain,
              },
            }
          }
          if (yDomain && nextEncoding.y) {
            nextEncoding.y = {
              ...nextEncoding.y,
              scale: {
                ...(nextEncoding.y.scale || {}),
                domain: yDomain,
              },
            }
          }

          const nextMark = typeof spec.mark === 'string'
            ? { type: spec.mark, clip: true }
            : {
                ...(spec.mark || {}),
                clip: true,
              }

          return {
            ...spec,
            mark: nextMark,
            encoding: nextEncoding,
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            ...(xDomain ? { xDomain } : {}),
            ...(yDomain ? { yDomain } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the scatterplot domain was updated.',
            'Read the target widget view state to confirm the new x/y domain values.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('scatter.identifyClusters')) {
    actionExecutor.register(
      { name: 'scatter.identifyClusters' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'scatter',
          message: 'scatter.identifyClusters requires a valid scatter target widget.',
        })
        const method = typeof params.method === 'string' && params.method.trim().length > 0
          ? params.method.trim().toLowerCase()
          : 'kmeans'
        const requestedClusters = Number.isFinite(params.nClusters) ? Math.floor(params.nClusters) : 3
        const nClusters = Math.max(1, requestedClusters)
        if (method !== 'kmeans') {
          throw new Error(`scatter.identifyClusters currently only supports the kmeans method. Received: ${method}.`)
        }

        const currentSpec = ctx.readCurrentSpec()
        const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
        const sourceRows = Array.isArray(visibleRows) && visibleRows.length > 0
          ? visibleRows
          : Array.isArray(currentSpec?.data?.values)
            ? currentSpec.data.values
            : []
        const rootEncoding = currentSpec?.layer?.[0]?.encoding || currentSpec?.encoding || {}
        const xField = rootEncoding?.x?.field || null
        const yField = rootEncoding?.y?.field || null
        if (!xField || !yField) {
          throw new Error('scatter.identifyClusters requires x and y encodings on the active scatter spec.')
        }

        const points = []
        const validSourceIndices = []
        sourceRows.forEach((row, rowIndex) => {
          const x = row?.[xField]
          const y = row?.[yField]
          if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
            points.push([x, y])
            validSourceIndices.push(rowIndex)
          }
        })
        if (points.length < nClusters) {
          throw new Error(`scatter.identifyClusters requires at least ${nClusters} visible numeric points.`)
        }

        const { labels, centers } = runKMeans(points, nClusters)
        const clusterField = `cluster_${nClusters}`
        const clusterStatistics = centers.map((center, clusterId) => ({
          cluster_id: clusterId,
          size: labels.filter((label) => label === clusterId).length,
          center,
        }))

        const sourceIndexToCluster = new Map()
        validSourceIndices.forEach((rowIndex, index) => {
          sourceIndexToCluster.set(rowIndex, labels[index])
        })

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for scatter cluster identification.')
          }

          const nextSpec = { ...spec }
          const baseValues = hasInlineObjectRows(spec)
            ? spec.data.values
            : isUrlBackedDataSpec(spec)
              ? sourceRows
              : []
          const nextValues = baseValues.map((row, rowIndex) => {
            const nextRow = { ...row }
            if (sourceIndexToCluster.has(rowIndex)) {
              nextRow[clusterField] = sourceIndexToCluster.get(rowIndex)
            }
            return nextRow
          })

          nextSpec.data = {
            ...(spec.data || {}),
            values: nextValues,
          }

          const nextEncoding = { ...(spec.encoding || {}) }
          nextEncoding.color = {
            field: clusterField,
            type: 'nominal',
            scale: { scheme: 'category10' },
            legend: { title: 'Cluster' },
          }

          nextSpec.encoding = nextEncoding
          nextSpec._scatter_cluster_state = {
            method,
            cluster_field: clusterField,
            n_clusters: nClusters,
            centers,
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            method,
            nClusters,
            clusterField,
            clusterStatistics,
            message: `Identified ${nClusters} clusters`,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the scatter color encoding now points to the derived cluster field.',
            'Read the target widget spec data values to confirm visible rows received cluster labels.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('scatter.showRegression')) {
    actionExecutor.register(
      { name: 'scatter.showRegression' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'scatter',
          message: 'scatter.showRegression requires a valid scatter target widget.',
        })
        const method = typeof params.method === 'string' && params.method.trim().length > 0
          ? params.method.trim().toLowerCase()
          : 'linear'
        if (!targetWidget) {
          throw new Error('scatter.showRegression requires a valid scatter target widget.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for scatter regression overlays.')
          }

          const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {}
          const xField = rootEncoding?.x?.field || null
          const yField = rootEncoding?.y?.field || null
          if (!xField || !yField) {
            throw new Error('scatter.showRegression requires x and y encodings on the active scatter spec.')
          }

          const regressionTransform = {
            regression: yField,
            on: xField,
          }
          if (method === 'poly') {
            regressionTransform.method = 'poly'
            regressionTransform.order = 3
          } else if (method === 'quad') {
            regressionTransform.method = 'poly'
            regressionTransform.order = 2
          } else if (method === 'log' || method === 'exp') {
            regressionTransform.method = method
          } else {
            regressionTransform.method = 'linear'
          }

          const regressionLayer = {
            _widgetvaTag: 'scatter.showRegression',
            mark: {
              type: 'line',
              color: 'red',
              strokeWidth: 2,
            },
            transform: [regressionTransform],
            encoding: {
              x: { field: xField, type: 'quantitative' },
              y: { field: yField, type: 'quantitative' },
            },
          }

          if (Array.isArray(spec.layer) && spec.layer.length > 0) {
            return {
              ...spec,
              layer: replaceTaggedLayer(spec.layer, 'scatter.showRegression', regressionLayer),
            }
          }

          const nextSpec = { ...spec }
          const baseLayer = {
            mark: spec.mark || 'point',
            encoding: spec.encoding || {},
          }
          delete nextSpec.mark
          delete nextSpec.encoding
          return {
            ...nextSpec,
            layer: replaceTaggedLayer([baseLayer], 'scatter.showRegression', regressionLayer),
          }
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            method,
            overlay: 'regression',
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify a tagged regression overlay layer was added to the scatterplot.',
            'Read the target widget view state to confirm the regression transform uses the current x/y fields and requested method.',
          ],
        }
      },
    )
  }
}

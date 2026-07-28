import {
  buildScatterCategoricalFilterPatch,
  buildScatterClusterAnalysisPatch,
  buildScatterRegressionOverlayPatch,
  buildScatterRegionSelectionPatch,
  buildScatterZoomDomainPatch,
} from './semanticPatches.js'

function targetWidgetState(targetWidget) {
  return { widgets: { [targetWidget.ref]: targetWidget } }
}

const SCATTER_SELECT_TAG = 'scatter.selectRegion'

function countRowsInRegion(rows, { xField, yField, xRange, yRange }) {
  const [xMin, xMax] = [Math.min(...xRange), Math.max(...xRange)]
  const [yMin, yMax] = [Math.min(...yRange), Math.max(...yRange)]
  const selectedRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const x = row?.[xField]
    const y = row?.[yField]
    return typeof x === 'number' && typeof y === 'number' && x >= xMin && x <= xMax && y >= yMin && y <= yMax
  })
  return {
    selectedCount: selectedRows.length,
    xRange: [xMin, xMax],
    yRange: [yMin, yMax],
  }
}

function buildScatterRegionActionOutput({
  params,
  ctx,
  actionName,
  selectionId,
  tag,
  selectionCountHint,
}) {
  const targetWidget = ctx.targetWidget()
  const xRange = Array.isArray(params.xRange) ? params.xRange : null
  const yRange = Array.isArray(params.yRange) ? params.yRange : null
  if (!targetWidget || !params.xField || !params.yField || !xRange || !yRange) {
    throw new Error(`${actionName} requires a scatter target, xField, yField, xRange, and yRange.`)
  }

  const rows = ctx.readRows(targetWidget.ref)
  const selected = countRowsInRegion(rows, {
    xField: params.xField,
    yField: params.yField,
    xRange,
    yRange,
  })

  return {
    patch: buildScatterRegionSelectionPatch({
      targetWidget,
      selectionId,
      xField: params.xField,
      yField: params.yField,
      xRange: selected.xRange,
      yRange: selected.yRange,
      selectedCount: selected.selectedCount,
      ...(tag ? { tag } : {}),
    }),
    affectedRefs: [targetWidget.ref],
    result: {
      selectedCount: selected.selectedCount,
    },
    selectedCount: selected.selectedCount,
    verificationHints: [
      'Read the updated widget selection state.',
      selectionCountHint,
    ],
    propagateFromSelection: true,
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

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function isScatterFamilyMark(mark) {
  const markType = readMarkType(mark)
  return markType === 'point' || markType === 'circle' || markType === 'square'
}

function collectNestedScatterSpecs(spec) {
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

function findRepresentativeScatterSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (isScatterFamilyMark(spec?.mark) && spec?.encoding && typeof spec.encoding === 'object') {
    return spec
  }
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => (
      entry && typeof entry === 'object' && isScatterFamilyMark(entry?.mark) && entry?.encoding && typeof entry.encoding === 'object'
    ))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedScatterSpecs(spec)) {
    const match = findRepresentativeScatterSpec(child)
    if (match) return match
  }
  return null
}

function detectScatterCategoricalField(spec, explicitField) {
  if (typeof explicitField === 'string' && explicitField.trim().length > 0) return explicitField
  const representativeSpec = findRepresentativeScatterSpec(spec) || spec
  return representativeSpec?.encoding?.color?.field || null
}

function computeLinearRegression(points) {
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const mx = mean(xs)
  const my = mean(ys)
  const denominator = xs.reduce((sum, x) => sum + ((x - mx) ** 2), 0)
  const slope = denominator === 0
    ? 0
    : points.reduce((sum, point) => sum + ((point.x - mx) * (point.y - my)), 0) / denominator
  const intercept = my - (slope * mx)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  return {
    slope,
    intercept,
    domain: [minX, maxX],
    points: [
      { x: minX, y: intercept + (slope * minX) },
      { x: maxX, y: intercept + (slope * maxX) },
    ],
  }
}

export function registerScatterActions(actionExecutor) {
  if (!actionExecutor.has('scatter.brushRegion')) {
    actionExecutor.register(
      { name: 'scatter.brushRegion' },
      async (params, ctx) => {
        return buildScatterRegionActionOutput({
          params,
          ctx,
          actionName: 'scatter.brushRegion',
          selectionId: 'brush',
          selectionCountHint: 'Call perception.summarizeSelection to confirm the selected count.',
        })
      },
    )
  }

  if (!actionExecutor.has('scatter.selectRegion')) {
    actionExecutor.register(
      { name: 'scatter.selectRegion' },
      async (params, ctx) => {
        return buildScatterRegionActionOutput({
          params,
          ctx,
          actionName: 'scatter.selectRegion',
          selectionId: 'region',
          tag: SCATTER_SELECT_TAG,
          selectionCountHint: 'Call perception.summarizeSelection to confirm the selected region count.',
        })
      },
    )
  }

  if (!actionExecutor.has('scatter.zoomDomain')) {
    actionExecutor.register(
      { name: 'scatter.zoomDomain' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const xDomain = Array.isArray(params.xDomain) ? params.xDomain : null
        const yDomain = Array.isArray(params.yDomain) ? params.yDomain : null
        if (!targetWidget || (!xDomain && !yDomain)) {
          throw new Error('scatter.zoomDomain requires a scatter target and at least one domain range.')
        }

        return {
          patch: buildScatterZoomDomainPatch({ targetWidget, xDomain, yDomain }),
          affectedRefs: [targetWidget.ref],
          propagateFromRef: `${targetWidget.ref}/view/zoom`,
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

  if (!actionExecutor.has('scatter.filterCategorical')) {
    actionExecutor.register(
      { name: 'scatter.filterCategorical' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const categoriesToRemove = Array.isArray(params.categoriesToRemove)
          ? params.categoriesToRemove.filter((value) => value != null)
          : []
        if (!targetWidget || categoriesToRemove.length === 0) {
          throw new Error('scatter.filterCategorical requires a scatter target and one or more categories to remove.')
        }

        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const spec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const field = typeof params.field === 'string' && params.field.trim().length > 0
          ? params.field.trim()
          : null
        if (!field) {
          throw new Error('scatter.filterCategorical requires a categorical field or color encoding on the active scatter spec.')
        }
        const rows = ctx.readRows(targetWidget.ref)
        const visibleCount = rows.filter((row) => !categoriesToRemove.includes(row?.[field])).length

        return {
          patch: buildScatterCategoricalFilterPatch({
            targetWidget,
            currentState,
            field,
            categoriesToRemove,
            visibleCount,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            field,
            categoriesToRemove,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the scatter transform now excludes the requested categories.',
            'Read the target widget rows to confirm the removed categories no longer appear in the visible scatter data.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('scatter.identifyClusters')) {
    actionExecutor.register(
      { name: 'scatter.identifyClusters' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const method = typeof params.method === 'string' && params.method.trim().length > 0
          ? params.method.trim().toLowerCase()
          : 'kmeans'
        const requestedClusters = Number.isFinite(params.nClusters) ? Math.floor(params.nClusters) : 3
        const nClusters = Math.max(1, requestedClusters)
        if (method !== 'kmeans') {
          throw new Error(`scatter.identifyClusters currently only supports the kmeans method. Received: ${method}.`)
        }

        const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || null
        const visibleRows = ctx.readRows(targetWidget.ref)
        const sourceRows = Array.isArray(visibleRows) && visibleRows.length > 0
          ? visibleRows
          : Array.isArray(currentSpec?.data?.values)
            ? currentSpec.data.values
            : []
        const xField = typeof params.xField === 'string' ? params.xField.trim() : null
        const yField = typeof params.yField === 'string' ? params.yField.trim() : null
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
        const annotatedRows = sourceRows.map((row, rowIndex) => {
          const nextRow = { ...row }
          if (sourceIndexToCluster.has(rowIndex)) {
            nextRow[clusterField] = sourceIndexToCluster.get(rowIndex)
          }
          return nextRow
        })
        const currentState = targetWidgetState(targetWidget)

        return {
          patch: buildScatterClusterAnalysisPatch({
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
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            method,
            nClusters,
            clusterField,
            clusterStatistics,
            centers,
            message: `Identified ${nClusters} clusters`,
          },
          verificationHints: [
            'Read the target widget state and confirm view.reencode.mode is clusterEncoding.',
            'Read the target widget data.analysis.clusters to confirm the derived cluster summary.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('scatter.showRegression')) {
    actionExecutor.register(
      { name: 'scatter.showRegression' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const method = typeof params.method === 'string' && params.method.trim().length > 0
          ? params.method.trim().toLowerCase()
          : 'linear'
        if (!targetWidget) {
          throw new Error('scatter.showRegression requires a valid scatter target widget.')
        }
        if (method !== 'linear') {
          throw new Error(`scatter.showRegression currently only supports the linear method. Received: ${method}.`)
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const xField = typeof params.xField === 'string' ? params.xField.trim() : null
        const yField = typeof params.yField === 'string' ? params.yField.trim() : null
        if (!xField || !yField) {
          throw new Error('scatter.showRegression requires x and y encodings.')
        }
        const rows = ctx.readRows(targetWidget.ref)
        const sourceRows = Array.isArray(rows) && rows.length > 0
          ? rows
          : Array.isArray(currentSpec?.data?.values)
            ? currentSpec.data.values
            : []
        const points = sourceRows
          .map((row) => ({ x: Number(row?.[xField]), y: Number(row?.[yField]) }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        if (points.length < 2) {
          throw new Error('scatter.showRegression requires at least two finite x/y points.')
        }
        const regression = computeLinearRegression(points)

        return {
          patch: buildScatterRegressionOverlayPatch({
            targetWidget,
            currentState,
            method,
            xField,
            yField,
            regression,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            method,
            overlay: 'regression',
            xField,
            yField,
            slope: regression.slope,
            intercept: regression.intercept,
          },
          verificationHints: [
            'Read the target widget state and confirm view.reencode.mode is regressionOverlay.',
            'Read data.analysis.regression to confirm the computed slope and intercept.',
          ],
        }
      },
    )
  }
}

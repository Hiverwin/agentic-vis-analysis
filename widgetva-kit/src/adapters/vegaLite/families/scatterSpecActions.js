import {
  findRepresentativeSpec,
  updateRepresentativeSpec,
} from '../specTree.js'
import { ensureObjectSpec, readMarkType } from '../specModel.js'
import {
  replaceFilterTransformForField,
  replaceTaggedLayer,
} from '../specMutators.js'
import {
  datumRef,
  expressionNotEqualsAny,
  hasInlineObjectRows,
  readInlineRows,
} from './specActionShared.js'

function isScatterFamilySpec(spec) {
  const markType = readMarkType(spec?.mark)
  return (markType === 'point' || markType === 'circle' || markType === 'square')
    && spec?.encoding
    && typeof spec.encoding === 'object'
    && !Array.isArray(spec.encoding)
}

function buildDatumBetweenTest(field, min, max) {
  return `${datumRef(field)} >= ${min} && ${datumRef(field)} <= ${max}`
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
        condition: { test: inBrushTest, value: 1 },
        value: 0.68,
      },
    },
  }
}

function applyBrushVisualToScatterSpec(scatterSpec, brush) {
  if (Array.isArray(scatterSpec.layer) && scatterSpec.layer.length > 0) {
    let applied = false
    return {
      ...scatterSpec,
      layer: scatterSpec.layer
        .filter((layer) => layer?._widgetvaTag !== 'scatter.brushRegion')
        .map((layer) => {
          if (!applied && !layer?._widgetvaTag) {
            const markType = readMarkType(layer?.mark)
            if (!markType || markType === 'point' || markType === 'circle' || markType === 'square') {
              applied = true
              return withBrushOpacity(layer, brush)
            }
          }
          return layer
        }),
      _scatter_brush_state: {
        fields: [brush.xField, brush.yField],
        xRange: [brush.xMin, brush.xMax],
        yRange: [brush.yMin, brush.yMax],
      },
    }
  }
  return {
    ...scatterSpec,
    encoding: withBrushOpacity({ encoding: scatterSpec.encoding || {} }, brush).encoding,
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
    if (!clusterPoints.length) return previousCenters[clusterIndex]
    const sums = clusterPoints.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
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

function updateScatterDataValues(spec, buildNextValues) {
  if (hasInlineObjectRows(spec)) {
    return {
      ...spec,
      data: { ...(spec.data || {}), values: buildNextValues(spec) },
    }
  }
  return updateRepresentativeSpec(
    spec,
    (entry) => isScatterFamilySpec(entry) && hasInlineObjectRows(entry),
    (scatterSpec) => ({
      ...scatterSpec,
      data: { ...(scatterSpec.data || {}), values: buildNextValues(scatterSpec) },
    }),
    'No active inline scatter data is available for scatter data updates.',
  )
}

export function executeVegaLiteScatterBrushLike(spec, params = {}, selectionId = 'brush') {
  ensureObjectSpec(spec, 'No active base spec is available for scatter brush visuals.')
  const xRange = Array.isArray(params.xRange) ? params.xRange : null
  const yRange = Array.isArray(params.yRange) ? params.yRange : null
  if (!params.xField || !params.yField || !xRange || !yRange) {
    throw new Error('scatter.brushRegion requires xField, yField, xRange, and yRange.')
  }
  const brush = {
    xField: params.xField,
    yField: params.yField,
    xMin: Math.min(...xRange),
    xMax: Math.max(...xRange),
    yMin: Math.min(...yRange),
    yMax: Math.max(...yRange),
  }
  return updateRepresentativeSpec(
    spec,
    isScatterFamilySpec,
    (scatterSpec) => ({
      ...applyBrushVisualToScatterSpec(scatterSpec, brush),
      _widgetva_selection_id: selectionId,
    }),
    'No representative scatter subview could be found in the active spec.',
  )
}

export function executeVegaLiteScatterFilterCategorical(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for scatter categorical filtering.')
  const representative = findRepresentativeSpec(spec, isScatterFamilySpec) || spec
  const field = typeof params.field === 'string'
    ? params.field
    : representative?.encoding?.color?.field || null
  const values = Array.isArray(params.categoriesToRemove)
    ? params.categoriesToRemove.filter((value) => value != null)
    : []
  if (!field || values.length === 0) {
    throw new Error('scatter.filterCategorical requires a field and categoriesToRemove.')
  }
  return updateRepresentativeSpec(
    spec,
    isScatterFamilySpec,
    (scatterSpec) => ({
      ...scatterSpec,
      transform: replaceFilterTransformForField(scatterSpec.transform, field, {
        filter: { not: { field, oneOf: values } },
        _widgetvaTag: 'scatter.filterCategorical',
      }),
    }),
    'No representative scatter subview could be found in the active spec.',
  )
}

export function executeVegaLiteScatterIdentifyClusters(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for scatter clustering.')
  const representative = findRepresentativeSpec(spec, isScatterFamilySpec) || spec
  const encoding = representative?.encoding || {}
  const xField = encoding?.x?.field
  const yField = encoding?.y?.field
  const rows = readInlineRows(representative).length > 0 ? readInlineRows(representative) : readInlineRows(spec)
  const points = rows
    .map((row, index) => ({ index, point: [Number(row?.[xField]), Number(row?.[yField])] }))
    .filter((entry) => Number.isFinite(entry.point[0]) && Number.isFinite(entry.point[1]))
  if (!xField || !yField || points.length === 0) {
    throw new Error('scatter.identifyClusters requires inline rows and quantitative x/y fields.')
  }
  const clusterCount = Number.isFinite(params.nClusters) ? Math.max(1, Math.floor(params.nClusters)) : 3
  const { labels } = runKMeans(points.map((entry) => entry.point), clusterCount)
  const labelsByRowIndex = new Map(points.map((entry, pointIndex) => [entry.index, labels[pointIndex]]))
  const nextSpec = updateScatterDataValues(spec, (sourceSpec) => readInlineRows(sourceSpec).map((row, index) => ({
    ...row,
    __widgetva_cluster: labelsByRowIndex.get(index) ?? null,
  })))
  return updateRepresentativeSpec(
    nextSpec,
    isScatterFamilySpec,
    (scatterSpec) => ({
      ...scatterSpec,
      encoding: {
        ...(scatterSpec.encoding || {}),
        color: { field: '__widgetva_cluster', type: 'nominal' },
      },
      _scatter_cluster_state: { nClusters: clusterCount, method: params.method || 'kmeans' },
    }),
    'No representative scatter subview could be found in the active spec.',
  )
}

export function executeVegaLiteScatterShowRegression(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for scatter regression.')
  return updateRepresentativeSpec(
    spec,
    isScatterFamilySpec,
    (scatterSpec) => {
      const encoding = scatterSpec.encoding || {}
      const xField = encoding?.x?.field
      const yField = encoding?.y?.field
      if (!xField || !yField) throw new Error('scatter.showRegression requires x and y encodings.')
      const rows = readInlineRows(scatterSpec).length > 0 ? readInlineRows(scatterSpec) : readInlineRows(spec)
      const points = rows
        .map((row) => ({ x: Number(row?.[xField]), y: Number(row?.[yField]) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      if (points.length < 2) throw new Error('scatter.showRegression requires at least two finite x/y points.')
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
      const regressionLayer = {
        _widgetvaTag: 'scatter.showRegression',
        data: {
          values: [
            { [xField]: minX, [yField]: intercept + (slope * minX) },
            { [xField]: maxX, [yField]: intercept + (slope * maxX) },
          ],
        },
        mark: { type: 'line', color: '#d62728', strokeWidth: 2 },
        encoding: {
          x: { ...encoding.x },
          y: { ...encoding.y },
        },
      }
      const baseLayer = Array.isArray(scatterSpec.layer)
        ? scatterSpec.layer.filter((layer) => layer?._widgetvaTag !== 'scatter.showRegression')
        : [{ mark: scatterSpec.mark || 'point', encoding }]
      const {
        mark: _removedMark,
        encoding: _removedEncoding,
        ...layeredSpec
      } = scatterSpec
      return {
        ...layeredSpec,
        layer: replaceTaggedLayer(baseLayer, 'scatter.showRegression', regressionLayer),
        _scatter_regression_state: { method: params.method || 'linear' },
      }
    },
    'No representative scatter subview could be found in the active spec.',
  )
}

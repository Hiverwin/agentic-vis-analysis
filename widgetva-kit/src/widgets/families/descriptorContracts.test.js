import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWidgetFamilyActionDescriptors,
  buildWidgetFamilyPerceptionDescriptors,
} from './index.js'

const kinds = ['scatter', 'bar', 'line', 'heatmap', 'parallelCoordinates', 'sankey']

test('family actions expose state effects and affected state paths', () => {
  for (const kind of kinds) {
    const descriptors = buildWidgetFamilyActionDescriptors(kind)
    for (const descriptor of descriptors) {
      assert.ok(descriptor.effects?.length, `${kind}/${descriptor.name} is missing effects`)
      assert.ok(descriptor.affectedStatePaths?.length, `${kind}/${descriptor.name} is missing affectedStatePaths`)
    }
  }
})

test('perception descriptors use explicit required fields and tightened numeric contracts', () => {
  const scatter = buildWidgetFamilyPerceptionDescriptors('scatter', { dataRef: 'data://visible' })
  const correlation = scatter.find((d) => d.name === 'perception.computeCorrelation')
  assert.deepEqual(correlation.paramsSchema.required, ['xField', 'yField'])

  const extremes = scatter.find((d) => d.name === 'perception.findExtremes')
  assert.deepEqual(extremes.paramsSchema.properties.direction.enum, ['min', 'max'])
  assert.equal(extremes.paramsSchema.properties.limit.type, 'integer')
  assert.equal(extremes.paramsSchema.properties.limit.minimum, 1)

  const outliers = scatter.find((d) => d.name === 'perception.findOutliers')
  assert.equal(outliers.paramsSchema.anyOf.length, 3)

  const line = buildWidgetFamilyPerceptionDescriptors('line', { dataRef: 'data://visible' })
  const anomalies = line.find((d) => d.name === 'perception.detectAnomalies')
  assert.deepEqual(anomalies.paramsSchema.required, ['yField'])
})

test('zoom descriptors require at least one domain', () => {
  const scatter = buildWidgetFamilyActionDescriptors('scatter')
  const zoom = scatter.find((d) => d.name === 'scatter.zoomDomain')
  assert.deepEqual(zoom.paramsSchema.anyOf, [{ required: ['xDomain'] }, { required: ['yDomain'] }])
})

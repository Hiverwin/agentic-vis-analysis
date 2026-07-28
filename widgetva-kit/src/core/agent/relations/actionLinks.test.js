import test from 'node:test'
import assert from 'node:assert/strict'

import { actionLinks } from './actionLinks/index.js'
import { barFamily, heatmapFamily, lineFamily, parallelCoordinatesFamily, sankeyFamily, scatterFamily } from '../../../widgets/families/index.js'

const families = [barFamily, heatmapFamily, lineFamily, parallelCoordinatesFamily, sankeyFamily, scatterFamily]

function actionNames(family) {
  return new Set(family.actions.buildDescriptors().map((descriptor) => descriptor.name))
}

test('action-link handbook only exposes real family actions and state-to-state effects', () => {
  for (const family of families) {
    const names = actionNames(family)
    for (const [actionName, effects] of Object.entries(actionLinks[family.kind] || {})) {
      assert.equal(names.has(actionName), true, `${actionName} is not declared by ${family.kind}`)
      assert.equal(Array.isArray(effects) && effects.length > 0, true, `${actionName} has no link effects`)
      for (const effect of effects) {
        assert.match(effect.sourceState, /^[A-Za-z][A-Za-z0-9]*\.(selection|view)\.[A-Za-z][A-Za-z0-9]*$/)
        assert.match(effect.targetState, /^[A-Za-z][A-Za-z0-9]*\.(transform|view)(\.[A-Za-z][A-Za-z0-9]*)?$/)
        assert.equal(typeof effect.effect, 'string')
      }
    }
  }
})

test('action-link handbook covers the implemented coordination source operations', () => {
  const required = {
    bar: {
      'bar.clickCategory': ['scatter.transform', 'scatter.view.highlight'],
      'bar.selectCategory': ['scatter.transform', 'scatter.view.highlight'],
      'bar.sortBars': ['heatmap.view.reencode'],
    },
    scatter: {
      'scatter.brushRegion': ['bar.transform', 'line.view.zoom'],
      'scatter.zoomDomain': ['bar.transform', 'line.view.zoom'],
    },
    line: {
      'line.selectSeries': ['bar.transform', 'scatter.view.highlight'],
      'line.selectXValue': ['bar.transform', 'scatter.view.highlight'],
      'line.zoomXRegion': ['bar.transform', 'scatter.view.zoom'],
    },
    heatmap: {
      'heatmap.selectCell': ['bar.transform', 'scatter.view.highlight'],
      'heatmap.selectSubmatrix': ['bar.transform', 'scatter.view.highlight'],
    },
    parallelCoordinates: {
      'parallelCoordinates.selectRecord': ['scatter.transform', 'bar.view.highlight'],
    },
    sankey: {
      'sankey.focusFlow': ['bar.transform', 'scatter.view.highlight'],
      'sankey.selectAggregateNode': ['bar.transform', 'scatter.view.highlight'],
      'sankey.collapseNodes': ['bar.view.reencode'],
    },
  }

  for (const [family, actions] of Object.entries(required)) {
    for (const [actionName, targetStates] of Object.entries(actions)) {
      const effects = actionLinks[family][actionName] || []
      const actualTargets = new Set(effects.map((effect) => effect.targetState))
      for (const targetState of targetStates) {
        assert.equal(actualTargets.has(targetState), true, `${actionName} is missing ${targetState}`)
      }
    }
  }
})

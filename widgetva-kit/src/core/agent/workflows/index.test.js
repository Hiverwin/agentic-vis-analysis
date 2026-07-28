import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAnalysisToAction,
  getSingleWidgetWorkflow,
  listAnalysisToAction,
  listMultiWidgetWorkflows,
  listSingleWidgetWorkflows,
  listWorkflows,
  multiWidgetWorkflows,
  singleWidgetWorkflows,
} from './index.js'

test('registers single-widget workflows in a shallow family index', () => {
  const families = ['bar', 'heatmap', 'line', 'parallelCoordinates', 'sankey', 'scatter']
  assert.deepEqual(Object.keys(singleWidgetWorkflows).sort(), [...families].sort())

  const workflows = listSingleWidgetWorkflows()
  assert.ok(workflows.length > 0)
  for (const workflow of workflows) {
    assert.match(workflow.id, /^WF-1V-[A-Z0-9-]+-\d{2}$/)
    assert.equal(workflow.scope, 'single_widget')
    assert.equal(workflow.viewCount, 1)
    assert.equal(workflow.families.length, 1)
    assert.equal(workflow.slug, `${workflow.families[0]}.${workflow.name}`)
    assert.equal(workflow.id.startsWith('WF-1V-'), true)
    assert.equal(typeof workflow.semanticName, 'string')
    assert.ok(Array.isArray(workflow.steps))
    for (const step of workflow.steps) {
      assert.ok(['action', 'perception'].includes(step.kind))
      assert.equal(typeof step.operation, 'string')
    }
  }
})

test('resolves a workflow by stable id or legacy name', () => {
  const workflow = getSingleWidgetWorkflow('WF-1V-SUBGROUP-RELATIONSHIP-MEASUREMENT-01')
  assert.deepEqual(workflow?.families, ['scatter'])
  assert.equal(workflow?.slug, 'scatter.filter_then_compute_correlation')
  assert.equal(getSingleWidgetWorkflow('scatter.filter_then_compute_correlation')?.id, workflow.id)
  assert.equal(getSingleWidgetWorkflow('filter_then_compute_correlation')?.id, workflow.id)
  assert.equal(getSingleWidgetWorkflow('missing.workflow'), null)
})

test('keeps multi-widget workflows in the same lookup catalog with semantic scope', () => {
  assert.ok(listMultiWidgetWorkflows().length > 0)
  const workflow = getSingleWidgetWorkflow('WF-2V-CATEGORY-TO-TREND-COMPARISON-02')
  assert.equal(workflow?.scope, 'multi_widget')

  const all = listWorkflows({ scope: 'multi_widget' })
  assert.equal(all.length, listMultiWidgetWorkflows().length)
  assert.ok(all.every((entry) => entry.families.length >= 2))
  assert.ok(all.every((entry) => /^WF-[23]V-[A-Z0-9-]+-\d{2}$/.test(entry.id)))
  assert.ok(all.every((entry) => entry.steps.every((step) => ['action', 'perception'].includes(step.kind))))
  assert.equal(new Set(listWorkflows().map((entry) => entry.id)).size, listWorkflows().length)
  assert.ok(Array.isArray(multiWidgetWorkflows['2V']))
  assert.ok(Array.isArray(multiWidgetWorkflows['3V']))
})

test('registers repeated category-to-profile comparison separately from generic investigation', () => {
  const workflow = getSingleWidgetWorkflow('WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10')

  assert.equal(workflow?.scope, 'multi_widget')
  assert.deepEqual(workflow?.families, ['bar', 'scatter'])
  assert.equal(workflow?.name, 'repeated_category_profile_comparison')
  assert.equal(workflow?.steps.filter((step) => step.operation === 'bar.selectCategory').length, 2)
  assert.equal(workflow?.steps.filter((step) => step.operation === 'perception.summarizeVisible').length, 3)
})

test('consolidates the distinct three-view workflows into the canonical multi-widget catalog', () => {
  const expected = [
    'WF-3V-CATEGORY-COHORT-TRIANGULATION-11',
    'WF-3V-CATEGORY-TREND-DRILLDOWN-12',
    'WF-3V-DERIVED-COHORT-TRIANGULATION-13',
    'WF-3V-FLOW-COHORT-EXPLANATION-14',
    'WF-3V-HIGHDIM-COHORT-PROFILE-15',
    'WF-3V-PERIOD-CONDITION-COMPARISON-16',
    'WF-3V-RELATIONSHIP-TRIANGULATION-17',
  ]

  for (const workflowId of expected) {
    const workflow = getSingleWidgetWorkflow(workflowId)
    assert.equal(workflow?.scope, 'multi_widget')
    assert.equal(workflow?.viewCount, 3)
    assert.ok(workflow.steps.some((step) => step.kind === 'action'))
    assert.ok(workflow.steps.some((step) => step.kind === 'perception'))
  }
})

test('indexes analysis-to-action handbook entries by stable ids', () => {
  const entries = listAnalysisToAction()
  assert.equal(entries.length, 29)
  assert.ok(entries.every((entry) => /^AT-1V-[A-Z0-9-]+-\d{2}$/.test(entry.id)))
  const entry = getAnalysisToAction('AT-1V-IDENTIFY-THE-MOST-OR-LEAST-IMPORTANT-CATEGORIES-01')
  assert.deepEqual(entry?.families, ['bar'])
  const first = entries[0]
  assert.equal(getAnalysisToAction(first.id)?.families.length, 1)
  assert.ok(Array.isArray(getAnalysisToAction(first.id)?.candidateActions))
})

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPlannerContext,
  getRelationGuidance,
  listRelationGuidance,
  buildAgentKnowledge,
  projectPlannerKnowledge,
  projectPlannerObservation,
  buildPlannerContextFromInstance,
} from './index.js'

test('planner context resolves only explicitly selected guidance', () => {
  const context = buildPlannerContext({
    analysisToActionIds: ['AT-1V-IDENTIFY-THE-MOST-OR-LEAST-IMPORTANT-CATEGORIES-01'],
    relationIds: [],
    workflowId: 'WF-1V-CONSTRAINED-RANKING-01',
  })

  assert.equal(context.analysisToAction.length, 1)
  assert.equal(context.relations.length, 0)
  assert.equal(context.workflow.id, 'WF-1V-CONSTRAINED-RANKING-01')
})

test('planner context gates abstraction guidance and workflow by benchmark level', () => {
  const ids = {
    analysisToActionIds: ['AT-1V-IDENTIFY-THE-MOST-OR-LEAST-IMPORTANT-CATEGORIES-01'],
    relationIds: ['REL-2V-BAR-SELECTCATEGORY-01'],
    workflowId: 'WF-1V-CONSTRAINED-RANKING-01',
  }
  assert.equal(buildPlannerContext({ ...ids, level: 1 }).analysisToAction.length, 0)
  assert.equal(buildPlannerContext({ ...ids, level: 1 }).relations.length, 0)
  assert.equal(buildPlannerContext({ ...ids, level: 1 }).workflow, null)
  assert.equal(buildPlannerContext({ ...ids, level: 2 }).analysisToAction.length, 1)
  assert.equal(buildPlannerContext({ ...ids, level: 2 }).relations.length, 1)
  assert.equal(buildPlannerContext({ ...ids, level: 2 }).workflow, null)
  assert.equal(buildPlannerContext({ ...ids, level: 3 }).workflow.id, ids.workflowId)
})

test('planner context accepts benchmark instance snake_case fields', () => {
  const context = buildPlannerContextFromInstance({
    planner_context: {
      relation_ids: ['REL-2V-BAR-SELECTCATEGORY-01'],
      workflow_id: 'WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10',
    },
  }, { level: 3 })

  assert.equal(context.relations.length, 1)
  assert.equal(context.workflow.id, 'WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10')
})

test('planner workflow projection preserves executable operations for progress tracking', () => {
  const context = buildPlannerContext({
    workflowId: 'WF-2V-REPEATED-CATEGORY-PROFILE-COMPARISON-10',
    level: 3,
  })

  assert.ok(context.workflow.steps.length > 0)
  assert.ok(context.workflow.steps.every((step) => typeof step.operation === 'string'))
})

test('relation guidance has stable multi-widget ids and is not a workflow catalog', () => {
  const relations = listRelationGuidance()
  assert.ok(relations.length > 0)
  assert.match(relations[0].id, /^REL-2V-[A-Z0-9-]+-01$/)
  assert.equal(relations[0].scope, 'multi_widget')
  assert.deepEqual(getRelationGuidance('missing-relation'), null)
})

test('relation catalog resolves canonical multidimensional filter guidance', () => {
  const context = buildPlannerContext({
    relationIds: ['REL-2V-PARALLELCOORDINATES-SELECTCOHORT-01'],
    level: 2,
  })

  assert.equal(context.relations.length, 1)
  assert.equal(context.relations[0].action, 'parallelCoordinates.selectCohort')
})

test('benchmark planner projections remove global agent guidance', () => {
  const knowledge = buildAgentKnowledge({ widgetKinds: ['bar'] })
  const observation = {
    state: {
      widgets: [{
        ref: 'wl://workspace/w/widget/w_bar',
        kind: 'bar',
        actionNames: ['bar.sortBars'],
        perceptionNames: ['perception.inspectViewConfig'],
      }],
    },
  }

  const flat = projectPlannerKnowledge(knowledge, { level: 1, observation })
  const widget = projectPlannerKnowledge(knowledge, { level: 2, observation })
  assert.equal('agentGuidance' in flat, false)
  assert.equal('agentGuidance' in widget, false)
  assert.equal(flat.tools.some((tool) => tool.name === 'bar.sortBars'), true)
  assert.deepEqual(
    Object.keys(flat.tools.find((tool) => tool.name === 'bar.sortBars')).sort(),
    ['description', 'kind', 'name', 'paramsSchema', 'target'],
  )
  assert.deepEqual(Object.keys(widget), ['widgetFamilies'])
})

test('direct-tools observation exposes only target refs and the captured image', () => {
  const observation = {
    query: 'Inspect the chart.',
    state: {
      stateId: 'state:1',
      widgets: [{
        ref: 'wl://workspace/w/widget/w_bar',
        kind: 'bar',
        title: 'Category sales',
        focused: true,
        encodings: { x: { field: 'category' } },
        data: { fieldValues: { category: ['A', 'B'] } },
      }],
      sharedAnalyticalState: { filters: { category: ['A'] } },
    },
    view: {
      image: { ref: 'image:1', mimeType: 'image/png', data: 'data:image/png;base64,abc' },
      summary: 'A bar chart.',
    },
  }

  const direct = projectPlannerObservation(observation, { level: 1 })
  const semantic = projectPlannerObservation(observation, { level: 2 })

  assert.deepEqual(direct.state, {
    stateId: 'state:1',
    widgets: [{ ref: 'wl://workspace/w/widget/w_bar', focused: true }],
  })
  assert.deepEqual(direct.view, {
    image: observation.view.image,
  })
  assert.deepEqual(semantic, observation)
})

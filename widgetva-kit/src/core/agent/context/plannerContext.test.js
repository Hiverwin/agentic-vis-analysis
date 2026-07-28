import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPlannerContext,
  getRelationGuidance,
  listRelationGuidance,
  buildAgentKnowledge,
  projectPlannerKnowledge,
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

test('planner context gates relations and workflow by benchmark level', () => {
  const ids = {
    analysisToActionIds: ['AT-1V-IDENTIFY-THE-MOST-OR-LEAST-IMPORTANT-CATEGORIES-01'],
    relationIds: ['REL-2V-BAR-SELECTCATEGORY-01'],
    workflowId: 'WF-1V-CONSTRAINED-RANKING-01',
  }
  assert.equal(buildPlannerContext({ ...ids, level: 1 }).analysisToAction.length, 1)
  assert.equal(buildPlannerContext({ ...ids, level: 1 }).relations.length, 0)
  assert.equal(buildPlannerContext({ ...ids, level: 1 }).workflow, null)
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

test('relation guidance has stable multi-widget ids and is not a workflow catalog', () => {
  const relations = listRelationGuidance()
  assert.ok(relations.length > 0)
  assert.match(relations[0].id, /^REL-2V-[A-Z0-9-]+-01$/)
  assert.equal(relations[0].scope, 'multi_widget')
  assert.deepEqual(getRelationGuidance('missing-relation'), null)
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
  assert.deepEqual(Object.keys(widget), ['widgetFamilies'])
})

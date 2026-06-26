import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceLinkPlanSchema,
  makeWorkspaceLinkPlan,
  makeWorkspacePlanningRequest,
  makeWorkspacePlanningResult,
  makeWorkspacePlanningTask,
  makeWorkspaceWidgetDataBinding,
  makeWorkspaceWidgetPlan,
  makeWorkspaceWidgetPlanSource,
  makeWorkspaceWidgetPlanTransform,
  describeWorkspacePlanningRequestSchema,
  describeWorkspacePlanningTaskSchema,
} from './planning.js'

test('describeWorkspacePlanningTaskSchema admits the richer task signals used by the runtime planner', () => {
  const schema = describeWorkspacePlanningTaskSchema()

  assert.equal(schema?.properties?.taskFamily?.enum?.includes('multiViewCoordination'), true)
  assert.equal(schema?.properties?.answerType?.enum?.includes('exploratory'), true)
  assert.equal(schema?.properties?.expectedAnswerType?.enum?.includes('bounded'), true)
  assert.equal(schema?.properties?.interactionHorizon?.enum?.includes('multi_step'), true)
  assert.equal(schema?.properties?.coordinationScope?.enum?.includes('workspace'), true)
  assert.equal(schema?.properties?.evidenceType?.enum?.includes('cross_widget'), true)
})

test('describeWorkspacePlanningRequestSchema carries the richer task schema through the planning request contract', () => {
  const schema = describeWorkspacePlanningRequestSchema()
  const taskSchema = schema?.properties?.task?.anyOf?.[1]
  const datasetSchema = schema?.properties?.datasetSchema?.anyOf?.[1]

  assert.equal(taskSchema?.properties?.taskFamily?.enum?.includes('lookup'), true)
  assert.equal(taskSchema?.properties?.answerType?.enum?.includes('exact'), true)
  assert.equal(taskSchema?.properties?.interactionHorizon?.enum?.includes('single_step'), true)
  assert.equal(taskSchema?.properties?.coordinationScope?.enum?.includes('multi_widget'), true)
  assert.equal(taskSchema?.properties?.evidenceType?.enum?.includes('interaction_revealed'), true)
  assert.equal(datasetSchema?.properties?.fields?.items?.properties?.name?.type, 'string')
  assert.equal(datasetSchema?.properties?.fields?.items?.properties?.type?.type, 'string')
})

test('planning constructors normalize nested widget/link planning payloads', () => {
  const task = makeWorkspacePlanningTask({
    taskFamily: 'compare',
  })
  const source = makeWorkspaceWidgetPlanSource({
    title: 'Primary scatter',
  })
  const transform = makeWorkspaceWidgetPlanTransform({
    kind: 'aggregate',
    metrics: [{ field: 'Horsepower', op: 'mean', as: 'avg_horsepower' }],
    sortBy: { field: 'avg_horsepower' },
  })
  const dataBinding = makeWorkspaceWidgetDataBinding({
    sourceWidgetId: 'scatter_main',
    transforms: [transform],
  })
  const widget = makeWorkspaceWidgetPlan({
    widgetId: 'bar_detail',
    role: 'detail',
    source,
    dataBinding,
  })
  const link = makeWorkspaceLinkPlan({
    linkId: 'scatter_to_bar',
    sourceWidgetId: 'scatter_main',
    targetWidgetId: 'bar_detail',
    kind: 'filters',
    fieldMapping: [{ sourceField: 'Origin', targetField: 'Origin' }],
  })
  const request = makeWorkspacePlanningRequest({
    task,
  })
  const result = makeWorkspacePlanningResult({
    widgets: [widget],
    links: [link],
  })

  assert.equal(task.targetWidgetRefs.length, 0)
  assert.equal(source.kind, 'baseSpec')
  assert.equal(transform.sortBy?.order, 'descending')
  assert.equal(dataBinding.transforms[0].metrics[0].as, 'avg_horsepower')
  assert.equal(widget.source.title, 'Primary scatter')
  assert.equal(widget.dataBinding?.sourceWidgetId, 'scatter_main')
  assert.equal(link.kind, 'filter')
  assert.equal(link.primitive, 'filter')
  assert.equal(link.activationPolicy, 'automatic')
  assert.equal(link.effectConstraint, null)
  assert.equal(Object.hasOwn(link, 'automatic'), false)
  assert.equal(Object.hasOwn(link, 'trigger'), false)
  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
  assert.equal(link.fieldMapping[0].targetField, 'Origin')
  assert.equal(request.task?.taskFamily, 'compare')
  assert.equal(request.datasetSchema?.fields?.[0]?.name, undefined)
  assert.equal(result.links[0].kind, 'filter')
  assert.equal(result.widgets[0].source.kind, 'baseSpec')
  assert.equal(result.links[0].fieldMapping[0].sourceField, 'Origin')
})

test('makeWorkspaceLinkPlan normalizes activationPolicy and effectConstraint as primary link-plan semantics', () => {
  const link = makeWorkspaceLinkPlan({
    linkId: 'scatter_to_heatmap',
    sourceWidgetId: 'scatter_main',
    targetWidgetId: 'heatmap_detail',
    primitive: 'filter',
    activationPolicy: 'automatic',
    effectConstraint: 'focusOnly',
  })

  assert.equal(link.activationPolicy, 'automatic')
  assert.equal(link.effectConstraint, 'focusOnly')
  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
})

test('makeWorkspaceLinkPlan preserves responseSpec on public planning link objects', () => {
  const link = makeWorkspaceLinkPlan({
    linkId: 'scatter_to_line',
    sourceWidgetId: 'scatter_main',
    targetWidgetId: 'line_detail',
    primitive: 'filter',
    responseSpec: {
      kind: 'drillDown',
      params: {
        dimension: 'time',
        fromLevel: 'year',
        toLevel: 'month',
      },
    },
  })

  assert.deepEqual(link.responseSpec, {
    kind: 'drillDown',
    params: {
      dimension: 'time',
      fromLevel: 'year',
      toLevel: 'month',
    },
  })
})

test('makeWorkspaceLinkPlan still accepts legacy link compatibility fields through makeWidgetLink normalization', () => {
  const link = makeWorkspaceLinkPlan({
    linkId: 'scatter_to_bar',
    sourceWidgetId: 'scatter_main',
    targetWidgetId: 'bar_detail',
    primitive: 'filter',
    propagationPolicy: 'highlightOnly',
    automatic: false,
    trigger: 'selectionChanged',
  })

  assert.equal(link.activationPolicy, 'manual')
  assert.equal(link.effectConstraint, 'highlightOnly')
  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(link, 'automatic'), false)
  assert.equal(Object.hasOwn(link, 'trigger'), false)
})

test('makeWorkspacePlanningRequest carries dataset schema through the planning request contract', () => {
  const request = makeWorkspacePlanningRequest({
    datasetSchema: {
      fields: [
        { name: 'Origin', type: 'nominal' },
        { name: 'Horsepower', type: 'quantitative' },
      ],
    },
  })

  assert.equal(request.datasetSchema?.fields?.[0]?.name, 'Origin')
  assert.equal(request.datasetSchema?.fields?.[0]?.type, 'nominal')
  assert.equal(request.datasetSchema?.fields?.[1]?.name, 'Horsepower')
})

test('describeWorkspaceLinkPlanSchema admits activationPolicy and effectConstraint', () => {
  const schema = describeWorkspaceLinkPlanSchema()

  assert.equal(schema?.properties?.activationPolicy?.type, 'string')
  assert.equal(schema?.properties?.effectConstraint?.type?.includes?.('null') ?? false, true)
  assert.equal(schema?.properties?.responseSpec?.type, 'object')
  assert.equal(Object.hasOwn(schema?.properties || {}, 'automatic'), false)
  assert.equal(Object.hasOwn(schema?.properties || {}, 'trigger'), false)
  assert.equal(Object.hasOwn(schema?.properties || {}, 'propagationPolicy'), false)
})

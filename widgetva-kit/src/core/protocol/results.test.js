import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeActionVerificationResultSchema,
  describeDataQueryResultSchema,
  describeLinkPropagationEvaluationSchema,
  describePerceptionResultSchema,
  describeStateDeltaTraceEntrySchema,
  describeStateSnapshotMetaSchema,
  describeTraceGraphSchema,
  describeWorkspaceSnapshotSchema,
  makeActionResult,
  makeActionVerificationResult,
  makeBranchReplayEventEntry,
  makeBranchSummary,
  makeDataQueryResult,
  makeLinkPropagationCheck,
  makeLinkPropagationEvaluation,
  makeLinkPropagationResult,
  makePerceptionResult,
  makeResultError,
  makeStateDeltaTraceEntry,
  makeStateSnapshotMeta,
  makeTraceGraph,
  makeTraceGraphEdge,
  makeTraceGraphNode,
  makeWorkspaceSnapshot,
  makeWorkspaceSnapshotMeta,
} from './results.js'

test('core result constructors normalize action, perception, and data-query results', () => {
  const error = makeResultError({ code: 'INVALID_PARAMS', message: 'bad input' })
  const actionResult = makeActionResult({ callId: 'call_1', actionName: 'scatter.brushRegion', ok: true })
  const perceptionResult = makePerceptionResult({ callId: 'query_1', queryName: 'perception.inspectSelection' })
  const verification = makeActionVerificationResult({ matchedActionName: 'scatter.brushRegion' })
  const dataQueryResult = makeDataQueryResult({ dataRef: 'wl://widgetva-app/workspace/main/data/current_view' })

  assert.equal(error.code, 'INVALID_PARAMS')
  assert.deepEqual(actionResult.updatedRefs, [])
  assert.equal(perceptionResult.queryName, 'perception.inspectSelection')
  assert.equal(verification.verified, false)
  assert.deepEqual(verification.linkPropagation, [])
  assert.equal(dataQueryResult.dataRef, 'wl://widgetva-app/workspace/main/data/current_view')
})

test('core history and trace constructors normalize snapshot and graph data', () => {
  const snapshotMeta = makeStateSnapshotMeta({ stateId: 'main:s1' })
  const workspaceSnapshotMeta = makeWorkspaceSnapshotMeta({ stateId: 'main:s1' })
  const workspaceSnapshot = makeWorkspaceSnapshot({ stateId: 'main:s1' })
  const branchSummary = makeBranchSummary({ branchId: 'main', label: 'Main' })
  const node = makeTraceGraphNode({ id: 'main:s1', stateId: 'main:s1' })
  const edge = makeTraceGraphEdge({ id: 'main:s0->main:s1', from_id: 'main:s0', to_id: 'main:s1' })
  const graph = makeTraceGraph({ nodes: [node], edges: [edge], branches: [branchSummary] })

  assert.equal(snapshotMeta.actor, 'system')
  assert.equal(workspaceSnapshotMeta.stateId, 'main:s1')
  assert.deepEqual(workspaceSnapshot.widgets, {})
  assert.equal(branchSummary.branchId, 'main')
  assert.equal(graph.nodes[0]?.stateId, 'main:s1')
  assert.equal(graph.edges[0]?.edge_type, 'continue')
})

test('link propagation constructors normalize nested checks', () => {
  const evaluation = makeLinkPropagationEvaluation({
    sourceRef: 'wl://widgetva-app/workspace/main/widget/scatter/selection/brush',
    results: [
      makeLinkPropagationResult({
        linkRef: 'wl://widgetva-app/workspace/main/link/scatter_to_bar',
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: 'highlightOnly',
        responseSpec: {
          kind: 'drillDown',
          params: {
            dimension: 'time',
          },
        },
        reason: 'manual_activation_policy',
        checks: [
          makeLinkPropagationCheck({
            name: 'targetExists',
            passed: true,
          }),
        ],
      }),
    ],
  })

  assert.equal(evaluation.results[0]?.activationPolicy, 'automatic')
  assert.equal(evaluation.results[0]?.effectConstraint, 'highlightOnly')
  assert.equal(evaluation.results[0]?.responseSpec?.kind, 'drillDown')
  assert.equal(evaluation.results[0]?.reason, 'manualLink')
  assert.equal(Object.hasOwn(evaluation.results[0], 'propagationPolicy'), false)
  assert.equal(evaluation.results[0]?.checks[0]?.name, 'targetExists')
  assert.equal(evaluation.consistencyScore, 1)
})

test('state delta and branch replay entries preserve replay metadata', () => {
  const stateDelta = makeStateDeltaTraceEntry({
    stateId: 'main:s1',
    statePatch: { widgets: { scatter: { selected: true } } },
  })
  const replayEvent = makeBranchReplayEventEntry({
    stateId: 'main:s2',
    transitionType: 'jump_back',
  })

  assert.deepEqual(stateDelta.statePatch, { widgets: { scatter: { selected: true } } })
  assert.equal(replayEvent.transitionType, 'jump_back')
  assert.equal(replayEvent.actor, 'system')
})

test('core result schemas admit runtime-facing history and verification fields', () => {
  const verificationSchema = describeActionVerificationResultSchema()
  const traceGraphSchema = describeTraceGraphSchema()
  const snapshotSchema = describeWorkspaceSnapshotSchema()
  const perceptionSchema = describePerceptionResultSchema()
  const dataQuerySchema = describeDataQueryResultSchema()
  const stateMetaSchema = describeStateSnapshotMetaSchema()
  const stateDeltaSchema = describeStateDeltaTraceEntrySchema()
  const linkPropagationSchema = describeLinkPropagationEvaluationSchema()

  assert.equal(verificationSchema.properties?.verified?.type, 'boolean')
  assert.equal(traceGraphSchema.properties?.nodes?.items?.properties?.responsePreview?.type?.includes?.('string') ?? false, true)
  assert.equal(snapshotSchema.properties?.replayContext?.anyOf?.[0]?.type, 'object')
  assert.equal(perceptionSchema.properties?.queryName?.type, 'string')
  assert.equal(dataQuerySchema.properties?.dataRef?.type?.includes?.('null') ?? false, true)
  assert.equal(stateMetaSchema.properties?.actor?.enum?.includes?.('system') ?? true, true)
  assert.equal(stateDeltaSchema.properties?.statePatch?.type, 'object')
  assert.equal(linkPropagationSchema.properties?.results?.items?.properties?.checks?.type, 'array')
  assert.equal(linkPropagationSchema.properties?.results?.items?.properties?.activationPolicy?.type, 'string')
  assert.equal(linkPropagationSchema.properties?.results?.items?.properties?.effectConstraint?.type?.includes?.('null') ?? false, true)
  assert.equal(linkPropagationSchema.properties?.results?.items?.properties?.responseSpec?.type?.includes?.('object') ?? false, true)
  assert.equal(linkPropagationSchema.properties?.results?.items?.properties?.reason?.type?.includes?.('string') ?? false, true)
})

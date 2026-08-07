import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTraceTimelineModel } from './traceViewModel.js'

test('buildTraceTimelineModel normalizes actors, edges, and delta tokens', () => {
  const model = buildTraceTimelineModel([
    {
      id: 't1',
      actor: 'human',
      kind: 'action',
      widgetTitle: 'Horsepower vs MPG',
      summary: 'Brush scatter region',
      stateDelta: { selection: true, viewport: true },
    },
    {
      id: 't2',
      actor: 'agent',
      kind: 'perception',
      widgetTitle: 'Horsepower vs MPG',
      summary: 'Verify brushed cluster',
      handoffFrom: 't1',
      stateDelta: { evidence: true, propagation: true },
    },
  ], { selectedStepId: 't2' })

  assert.equal(model.steps.length, 2)
  assert.equal(model.nodes.length, 2)
  assert.equal(model.lanes.length, 2)
  assert.equal(model.provenanceGraph.nodes.length, 2)
  assert.equal(model.provenanceGraph.edges.length, 1)
  assert.equal(model.nodes[0].lane, 'human')
  assert.equal(model.nodes[1].lane, 'agent')
  assert.equal(model.nodes[0].branchDepth, 0)
  assert.equal(model.nodes[0].hasStateDelta, true)
  assert.equal(model.nodes[1].hasEvidence, true)
  assert.equal(model.edges.length, 1)
  assert.equal(model.edges[0].kind, 'handoff')
  assert.equal(model.selectedStep?.id, 't2')
  assert.equal(model.selection.selectedStep?.id, 't2')
  assert.equal(model.selection.selectedNode?.id, 't2')
  assert.equal(model.handoffCount, 1)
  assert.equal(model.stats.handoffCount, 1)
  assert.equal(model.stats.evidenceStepCount, 1)
  assert.equal(model.stats.stateDeltaStepCount, 2)
  assert.equal(model.stats.segmentCount, 2)
  assert.equal(model.streamBands.length, 1)
  assert.equal(model.segments.length, 2)
  assert.equal(model.pathSummaries.length, 1)
  assert.equal(model.pathSummaries[0]?.segmentCount, 2)
  assert.equal(model.pathSummaries[0]?.hasHandoff, true)
  assert.equal(model.pathSummaries[0]?.hasEvidence, true)
  assert.equal(model.segments[0]?.stepCount, 1)
  assert.equal(model.segments[1]?.stepCount, 1)
  assert.equal(model.segments[1]?.hasEvidence, true)
  assert.equal(model.nodes[0]?.segmentId, model.segments[0]?.id)
  assert.equal(model.nodes[0]?.isSegmentStart, true)
  assert.equal(model.nodes[0]?.isSegmentEnd, true)
  assert.equal(model.nodes[1]?.segmentId, model.segments[1]?.id)
  assert.equal(model.nodes[1]?.segmentIndex, 0)
  assert.equal(model.selection.selectedSegment?.id, model.segments[1]?.id)
  assert.equal(model.selection.currentSegment?.id, model.segments[1]?.id)
  assert.equal(model.segments[0]?.selected, false)
  assert.equal(model.segments[1]?.selected, true)
})

test('buildTraceTimelineModel keeps same-actor progression as sequence edges', () => {
  const model = buildTraceTimelineModel([
    { id: 'h1', actor: 'human', kind: 'action', summary: 'Brush scatter', widgetTitle: 'Scatter' },
    { id: 'h2', actor: 'human', kind: 'action', summary: 'Filter heatmap', widgetTitle: 'Heatmap' },
    { id: 'a1', actor: 'agent', kind: 'perception', summary: 'Verify trend', widgetTitle: 'Scatter' },
  ], { selectedStepId: 'h2' })

  assert.equal(model.nodes.length, 3)
  assert.equal(model.edges.length, 2)
  assert.equal(model.edges[0].kind, 'sequence')
  assert.equal(model.edges[1].kind, 'handoff')
  assert.equal(model.selectedStep?.id, 'h2')
  assert.equal(model.streamBands[0]?.label, 'Main')
  assert.equal(model.selection.currentStep?.id, 'a1')
  assert.equal(model.stats.branchCount, 0)
  assert.equal(model.segments.length, 2)
  assert.equal(model.pathSummaries.length, 1)
  assert.equal(model.pathSummaries[0]?.dominantActor, 'mixed')
  assert.equal(model.pathSummaries[0]?.segmentCount, 2)
  assert.equal(model.segments[0]?.label, '1-2')
  assert.equal(model.segments[0]?.dominantActor, 'human')
  assert.equal(model.segments[1]?.label, '3')
  assert.equal(model.segments[1]?.dominantActor, 'agent')
  assert.equal(model.nodes[0]?.segmentId, model.segments[0]?.id)
  assert.equal(model.nodes[0]?.isSegmentStart, true)
  assert.equal(model.nodes[1]?.segmentId, model.segments[0]?.id)
  assert.equal(model.nodes[1]?.isSegmentEnd, true)
  assert.equal(model.nodes[1]?.segmentStepCount, 2)
  assert.equal(model.nodes[2]?.segmentId, model.segments[1]?.id)
  assert.equal(model.selection.selectedSegment?.id, model.segments[0]?.id)
  assert.equal(model.selection.currentSegment?.id, model.segments[1]?.id)
})

test('buildTraceTimelineModel assigns compact trace colors by operation topic, not actor', () => {
  const model = buildTraceTimelineModel([
    { id: 'human-brush', actor: 'human', kind: 'action', methodName: 'scatter.brush', widgetTitle: 'Scatter' },
    { id: 'agent-filter', actor: 'agent', kind: 'action', methodName: 'bar.filterCategorical', widgetTitle: 'Bar' },
    { id: 'agent-verify', actor: 'agent', kind: 'perception', methodName: 'inspect.view', widgetTitle: 'Bar' },
  ])

  assert.equal(model.nodes[0].operationTopic, 'selection')
  assert.equal(model.nodes[1].operationTopic, 'filter')
  assert.equal(model.nodes[2].operationTopic, 'inspect')
})

test('buildTraceTimelineModel derives branch metadata from replay lineage semantics', () => {
  const model = buildTraceTimelineModel([
    {
      id: 'h0',
      actor: 'human',
      kind: 'action',
      summary: 'Initial aligned view',
      widgetTitle: 'Scatter',
      resultStateId: 'main:s1',
      transitionType: 'continuation',
      branchId: 'main',
    },
    {
      id: 'h1',
      actor: 'human',
      kind: 'action',
      summary: 'Brush scatter',
      widgetTitle: 'Scatter',
      resultStateId: 'main:s2',
      transitionType: 'continuation',
      branchId: 'main',
    },
    {
      id: 'r1',
      actor: 'human',
      kind: 'replay',
      summary: 'Restore main:s1',
      widgetTitle: 'Workspace',
      sourceStateId: 'main:s2',
      resultStateId: 'main:s1',
      transitionType: 'branch',
      branchId: 'trace_branch_1',
      branchFromStateId: 'main:s1',
      stateDelta: { branch: true, viewport: true },
    },
    {
      id: 'a1',
      actor: 'agent',
      kind: 'action',
      summary: 'Verify alternate region',
      widgetTitle: 'Scatter',
      sourceStateId: 'main:s1',
      resultStateId: 'main:s3',
      transitionType: 'branch',
      branchId: 'trace_branch_1',
      branchFromStateId: 'main:s1',
      verificationSummary: 'Checked the alternate region.',
      stateDelta: { evidence: true, propagation: true },
    },
  ], { selectedStepId: 'a1' })

  assert.equal(model.branches.length, 1)
  assert.equal(model.branches[0]?.branchId, 'trace_branch_1')
  assert.equal(model.branches[0]?.originStateId, 'main:s1')
  assert.equal(model.branches[0]?.originSequenceIndex, 0)
  assert.equal(model.branches[0]?.entrySequenceIndex, 2)
  assert.deepEqual(model.branchOrder, ['main', 'trace_branch_1'])
  assert.equal(model.nodes[2]?.transitionType, 'branch')
  assert.equal(model.nodes[3]?.branchId, 'trace_branch_1')
  assert.equal(model.nodes[2]?.branchDepth, 1)
  assert.equal(model.nodes[3]?.branchDepth, 1)
  assert.equal(model.nodes[3]?.hasEvidence, true)
  assert.equal(model.edges.some((edge) => edge.kind === 'branch'), true)
  assert.equal(model.edges.find((edge) => edge.kind === 'branch')?.from, 'h0')
  assert.equal(model.edges.find((edge) => edge.kind === 'branch')?.to, 'r1')
  assert.equal(model.streamBands.length, 2)
  assert.equal(model.streamBands[1]?.label, 'Branch 1')
  assert.equal(model.streamBands[1]?.originStepId, 'h0')
  assert.equal(model.streamBands[1]?.originStepNumber, 1)
  assert.equal(model.streamBands[1]?.entryStepId, 'r1')
  assert.equal(model.streamBands[1]?.entryStepNumber, 3)
  assert.equal(model.streamBands[1]?.latestStepId, 'a1')
  assert.equal(model.streamBands[1]?.latestStepNumber, 4)
  assert.equal(model.streamBands[1]?.stepCount, 2)
  assert.equal(model.streamBands[1]?.originSequenceIndex, 0)
  assert.equal(model.streamBands[1]?.startSequenceIndex, 0)
  assert.equal(model.selection.currentBranchId, 'trace_branch_1')
  assert.equal(model.pathSummaries.length, 2)
  assert.equal(model.pathSummaries[0]?.branchId, 'main')
  assert.equal(model.pathSummaries[0]?.segmentCount, 1)
  assert.equal(model.pathSummaries[1]?.branchId, 'trace_branch_1')
  assert.equal(model.pathSummaries[1]?.hasBranchEntry, true)
  assert.equal(model.pathSummaries[1]?.hasEvidence, true)
  assert.equal(model.pathSummaries[1]?.segmentCount, 2)
  assert.equal(model.selection.selectedNode?.id, 'a1')
  assert.equal(model.provenanceGraph.branches[0]?.stepIds.length, 2)
  assert.equal(model.provenanceGraph.branches[0]?.replayStepCount, 1)
  assert.equal(model.provenanceGraph.branches[0]?.analyticalStepCount, 1)
  assert.equal(model.provenanceGraph.branches[0]?.latestStepId, 'a1')
  assert.equal(model.provenanceGraph.branches[0]?.stateDeltaCount, 2)
  assert.equal(model.provenanceGraph.branches[0]?.evidenceCount, 1)
  assert.equal(model.provenanceGraph.segments.length, 3)
  assert.equal(model.provenanceGraph.paths.length, 2)
  assert.equal(model.provenanceGraph.paths[1]?.branchId, 'trace_branch_1')
  assert.equal(model.segments.length, 3)
  assert.equal(model.segments[0]?.branchId, 'main')
  assert.equal(model.segments[0]?.stepCount, 2)
  assert.equal(model.segments[1]?.branchId, 'trace_branch_1')
  assert.equal(model.segments[1]?.branchEntry, true)
  assert.equal(model.segments[1]?.stepCount, 1)
  assert.equal(model.segments[2]?.hasEvidence, true)
  assert.equal(model.nodes[2]?.segmentId, model.segments[1]?.id)
  assert.equal(model.nodes[2]?.isSegmentStart, true)
  assert.equal(model.nodes[2]?.isSegmentEnd, true)
  assert.equal(model.nodes[3]?.segmentId, model.segments[2]?.id)
  assert.equal(model.selection.selectedSegment?.id, model.segments[2]?.id)
  assert.equal(model.selection.currentSegment?.id, model.segments[2]?.id)
  assert.equal(model.segments[0]?.selected, false)
  assert.equal(model.segments[2]?.selected, true)
  assert.equal(model.stats.branchCount, 1)
  assert.equal(model.stats.segmentCount, 3)
  assert.equal(model.stats.evidenceStepCount, 1)
})

test('buildTraceTimelineModel splits segments on evidence transitions even within the same actor and branch', () => {
  const model = buildTraceTimelineModel([
    { id: 's1', actor: 'human', kind: 'action', summary: 'Brush region', widgetTitle: 'Scatter' },
    { id: 's2', actor: 'human', kind: 'action', summary: 'Refine region', widgetTitle: 'Scatter', verificationSummary: 'Candidate pattern confirmed.' },
    { id: 's3', actor: 'human', kind: 'action', summary: 'Continue after confirmation', widgetTitle: 'Scatter' },
  ], { selectedStepId: 's3' })

  assert.equal(model.segments.length, 3)
  assert.equal(model.segments[0]?.label, '1')
  assert.equal(model.segments[1]?.hasEvidence, true)
  assert.equal(model.segments[2]?.label, '3')
  assert.equal(model.selection.selectedSegment?.id, model.segments[2]?.id)
})

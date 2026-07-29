import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTraceTimelineModel } from '../models/traceViewModel.js'
import { buildTraceStreamLayout } from './traceLayout.js'

test('buildTraceStreamLayout returns stable node, rail, and marker geometry for provenance branches', () => {
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
      stateDelta: { selection: true },
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
      kind: 'perception',
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

  const layout = buildTraceStreamLayout(model)

  assert.equal(layout.bandCount, 2)
  assert.equal(layout.canvasWidth >= 456, true)
  assert.equal(layout.canvasHeight > 100, true)
  assert.equal(layout.bandRails.length, 2)
  assert.equal(layout.bandFlows.length, 2)
  assert.equal(layout.bandMarkers.length, 1)
  assert.equal(layout.branchJunctions.length, 1)
  assert.equal(layout.pathChips.length, 2)
  assert.equal(layout.segmentChips.length, 3)
  assert.equal(layout.bandMarkers[0]?.branchId, 'trace_branch_1')
  assert.equal(layout.bandMarkers[0]?.x, layout.bandRails[1]?.x)
  assert.equal(layout.bandRails[1]?.x < layout.placedNodes[2]?.x, true)
  assert.equal(layout.bandFlows[1]?.width > 80, true)
  assert.equal(layout.branchJunctions[0]?.originStepId, 'h0')
  assert.equal(layout.segmentChips[0]?.width > 120, true)
  assert.equal(layout.pathChips[1]?.branchId, 'trace_branch_1')
  assert.equal(layout.pathChips[1]?.segmentCount, 2)
  assert.equal(layout.segmentChips[1]?.stepCount, 1)
  assert.equal(layout.segmentChips[2]?.branchId, 'trace_branch_1')
  assert.equal(layout.placedNodes.length, 4)
  assert.equal(layout.placedNodes[0]?.x < layout.placedNodes[1]?.x, true)
  assert.equal(layout.placedNodes[2]?.y > layout.placedNodes[1]?.y, true)
  assert.equal(layout.placedNodes[3]?.selected, true)
})

test('buildTraceStreamLayout keeps a readable empty-state canvas when trace is empty', () => {
  const model = buildTraceTimelineModel([], {})
  const layout = buildTraceStreamLayout(model)

  assert.equal(layout.bandCount, 1)
  assert.equal(layout.canvasWidth > 0, true)
  assert.equal(layout.canvasHeight > 0, true)
  assert.deepEqual(layout.placedNodes, [])
  assert.deepEqual(layout.bandMarkers, [])
  assert.deepEqual(layout.pathChips, [])
  assert.deepEqual(layout.segmentChips, [])
})

test('buildTraceStreamLayout can aggregate collapsed segments into a segment-first render view', () => {
  const model = buildTraceTimelineModel([
    {
      id: 'h1',
      actor: 'human',
      kind: 'action',
      summary: 'Brush scatter',
      widgetTitle: 'Scatter',
      branchId: 'main',
    },
    {
      id: 'h2',
      actor: 'human',
      kind: 'action',
      summary: 'Refine scatter',
      widgetTitle: 'Scatter',
      branchId: 'main',
    },
    {
      id: 'h3',
      actor: 'human',
      kind: 'action',
      summary: 'Lock region',
      widgetTitle: 'Scatter',
      branchId: 'main',
    },
    {
      id: 'a1',
      actor: 'agent',
      kind: 'perception',
      summary: 'Verify region',
      widgetTitle: 'Scatter',
      branchId: 'main',
      verificationSummary: 'Pattern confirmed.',
    },
  ], { selectedStepId: 'a1' })

  const collapsedLayout = buildTraceStreamLayout(model, {
    collapsedSegmentIds: [model.segments[0]?.id],
  })

  assert.equal(model.segments[0]?.stepCount, 3)
  assert.equal(collapsedLayout.placedNodes.length, 4)
  assert.equal(collapsedLayout.renderNodes.length, 2)
  assert.deepEqual(collapsedLayout.renderNodes.map((node) => node.id), ['h3', 'a1'])
  assert.equal(collapsedLayout.renderEdges.length, 1)
  assert.equal(collapsedLayout.renderEdges[0]?.from, 'h3')
  assert.equal(collapsedLayout.renderEdges[0]?.to, 'a1')
  assert.equal(collapsedLayout.renderEdges[0]?.kind, 'handoff')
})

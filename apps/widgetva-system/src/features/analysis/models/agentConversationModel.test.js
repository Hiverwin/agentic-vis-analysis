import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAgentConversationItems,
  buildAgentTraceIterationSources,
  buildIterationCardData,
  buildLatestMessageIterationSource,
  buildLatestTraceIterationSource,
} from './agentConversationModel.js'
import {
  collectPayloadLines,
  formatPreview,
  latestAssistantMessageText,
  readMessageText,
  uniqLines,
} from '../utils/agentPayloadFormatting.js'

test('payload formatting helpers normalize message text and compact nested payloads', () => {
  assert.equal(readMessageText({ content: 'from content' }), 'from content')
  assert.equal(readMessageText({ text: 'from text', content: 'ignored' }), 'from text')
  assert.equal(formatPreview({ a: 'x'.repeat(220) }).endsWith('...'), true)
  assert.deepEqual(uniqLines(['one', 'one', '', 'two']), ['one', 'two'])
  assert.equal(
    latestAssistantMessageText([
      { role: 'user', text: 'question' },
      { role: 'assistant', content: 'answer' },
    ]),
    'answer',
  )

  assert.deepEqual(
    collectPayloadLines({
      query: 'Inspect the chart',
      workspace: { ignored: true },
      filters: ['Origin', 'Year'],
      nested: { count: 2 },
    }),
    [
      'query: Inspect the chart',
      'filters: Origin, Year',
      'nested.count: 2',
    ],
  )
})

test('buildIterationCardData adapts agent turn data into IterationCard view model', () => {
  const iteration = buildIterationCardData(
    {
      model: 'test-model',
      recordedAt: '2026-07-12T01:02:03.000Z',
      traceStep: {
        id: 'trace-1',
        stepNumber: 3,
        status: 'completed',
        methodName: 'scatter.brushRegion',
        verificationSummary: 'Visual change verified',
      },
      turn: {
        observe: {
          query: 'Focus the scatterplot',
          view: { summary: 'scatter visible' },
        },
        plan: {
          rationale: 'Brush the target region first',
          step: { name: 'scatter.brushRegion' },
        },
        act: {
          name: 'scatter.brushRegion',
          params: { xRange: [80, 140] },
          result: { ok: true },
        },
        verify: {
          ok: true,
          summary: 'Selection changed',
        },
        reason: {
          answer: 'The selected records match the brushed region.',
        },
      },
    },
    [],
  )

  assert.equal(iteration?.iterKey, 'trace-1')
  assert.equal(iteration?.iteration, 3)
  assert.equal(iteration?.activePhase, 'act')
  assert.equal(iteration?.phases.observe.summary, 'Query: Focus the scatterplot')
  assert.equal(iteration?.phases.plan.summary, 'Brush the target region first')
  assert.equal(iteration?.phases.act.summary, 'scatter.brushRegion')
  assert.equal(iteration?.phases.verify.summary, 'Selection changed')
  assert.equal(iteration?.tools[0]?.toolName, 'scatter.brushRegion')
  assert.deepEqual(iteration?.tools[0]?.args, { xRange: [80, 140] })
  assert.deepEqual(iteration?.tools[0]?.detailLines.slice(0, 2), [
    'Operation: scatter.brushRegion',
    'Parameter: xRange: 80 to 140',
  ])
  assert.equal(iteration?.finalResponse, 'The selected records match the brushed region.')
  assert.equal(iteration?.mode, 'test-model')
})

test('buildIterationCardData marks action tools failed when the runtime result is not ok', () => {
  const iteration = buildIterationCardData(
    {
      model: 'test-model',
      recordedAt: '2026-07-12T01:02:03.000Z',
      traceStep: {
        id: 'trace-failed-action',
        stepNumber: 1,
        status: 'completed',
        methodName: 'line.boldLines',
      },
      turn: {
        act: {
          name: 'line.boldLines',
          params: { lineNames: ['TechCorp'] },
          result: { ok: false, summary: 'The selected step did not execute successfully.' },
        },
        verify: {
          ok: false,
          summary: 'The selected step did not execute successfully.',
        },
      },
    },
    [],
  )

  assert.equal(iteration?.status, 'failed')
  assert.equal(iteration?.tools[0]?.status, 'failed')
  assert.equal(iteration?.tools[0]?.toolName, 'line.boldLines')
})

test('buildIterationCardData keeps truncated JSON verification out of readable summaries', () => {
  const iteration = buildIterationCardData(
    {
      traceStep: {
        id: 'trace-jsonish-verify',
        stepNumber: 1,
        status: 'completed',
        methodName: 'scatter.selectRegion',
      },
      turn: {
        observe: {
          query: 'Select high spend and high visitor points.',
          state: { stateId: 'main:s1', widgets: [] },
        },
        plan: {
          rationale: 'Select the high-value scatterplot region.',
          step: {
            name: 'scatter.selectRegion',
            target: { widgetRef: 'wl://demo/workspace/main/widget/scatter_a' },
            params: {
              xField: 'marketing spend',
              yField: 'visitors',
              xRange: [3500, 5500],
              yRange: [9000, 12000],
            },
          },
        },
        act: {
          kind: 'action',
          name: 'scatter.selectRegion',
          target: { widgetRef: 'wl://demo/workspace/main/widget/scatter_a' },
          params: {
            xField: 'marketing spend',
            yField: 'visitors',
            xRange: [3500, 5500],
            yRange: [9000, 12000],
          },
          ok: true,
          stateId: 'main:s2',
          updatedRefs: ['wl://demo/workspace/main/widget/scatter_a'],
        },
        verify: {
          ok: true,
          summary: '{"verified":true,"matchedStateId":"main:s2","missingR',
          checks: {
            visualChange: {
              ok: true,
              summary: '{"verified":true,"matchedStateId":"main:s2","missingR',
            },
          },
        },
      },
    },
    [],
  )

  assert.equal(iteration?.verifyLines.some((line) => line.includes('missingR')), false)
  assert.equal(iteration?.verifyLines.some((line) => line.includes('structured verification evidence')), true)
  assert.equal(iteration?.tools[0]?.detailLines.includes('Target: scatter_a'), true)
  assert.equal(iteration?.tools[0]?.detailLines.includes('Parameter: marketing spend: 3500 to 5500'), true)
})

test('conversation model pairs assistant messages with trace-backed iteration sources', () => {
  const trace = [
    { actor: 'system', id: 'system-1' },
    { actor: 'agent', id: 'agent-1', time: '2026-07-12T01:00:00.000Z', summary: 'First' },
    { actor: 'agent', id: 'agent-2', time: '2026-07-12T01:01:00.000Z', summary: 'Second' },
  ]
  const traceSources = buildAgentTraceIterationSources(trace)

  assert.equal(traceSources.length, 2)
  assert.equal(traceSources[0]?.traceStep?.stepNumber, 2)
  assert.equal(buildLatestTraceIterationSource(trace)?.traceStep?.id, 'agent-2')
  assert.equal(buildLatestMessageIterationSource([{ role: 'assistant', text: 'Done' }])?.traceStep?.detail, 'Done')

  const items = buildAgentConversationItems({
    agentMessages: [
      { role: 'user', text: 'Question' },
      { role: 'assistant', text: 'Answer one' },
      { role: 'assistant', text: 'Answer two' },
    ],
    agentTraceSources: traceSources,
    agentError: 'Last error',
  })

  assert.deepEqual(items.map((item) => item.type), ['message', 'iteration', 'iteration', 'message'])
  assert.equal(items[0]?.message?.text, 'Question')
  assert.equal(items[1]?.source?.traceStep?.id, 'agent-1')
  assert.equal(items[2]?.source?.traceStep?.id, 'agent-2')
  assert.equal(items[1]?.source?.traceStep?.stepNumber, 1)
  assert.equal(items[2]?.source?.traceStep?.stepNumber, 2)
  assert.equal(items[3]?.message?.role, 'error')
})

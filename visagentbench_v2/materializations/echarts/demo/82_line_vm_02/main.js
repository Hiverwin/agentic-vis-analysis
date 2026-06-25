import * as echarts from 'https://cdn.jsdelivr.net/npm/echarts@5/+esm'
import { createEChartsLineChartWrapper } from '../../reference/lineChartWrapper.js'
import { connectSingleWidgetPagePortClient } from '../../../demoShared/pagePortActionClient.js'
import { mountSingleWidgetDemo } from '../../../demoShared/widgetRuntimeHarness.js'

const PACKAGE_ROOT = '../../../../'
const BENCHMARK_PATH = `${PACKAGE_ROOT}benchmarks/main/vague_multi_variants/type2/vague_multi/82_line_vm_02_type1a_type2.json`

const state = {
  benchmark: null,
  rows: [],
  lineRows: [],
  allCategories: [],
  chart: null,
  wrapper: null,
  controller: null,
  transport: null,
}

function el(id) {
  return document.getElementById(id)
}

function categorizeQuestionStyle(style) {
  return style === 'natural_language' ? 'Natural language' : 'Tool hinted'
}

function benchmarkQuestion() {
  return state.benchmark.question_set[0]
}

function groundTruth() {
  return benchmarkQuestion().ground_truth
}

function aggregateRows(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.Date}__${row['Product Category']}`
    const previous = grouped.get(key) || 0
    grouped.set(key, previous + (Number(row['Total Revenue']) || 0))
  }

  return [...grouped.entries()].map(([key, revenue]) => {
    const [date, series] = key.split('__')
    return { date, series, revenue }
  })
}

function buildLineSpec(rows) {
  return {
    data: {
      values: rows,
    },
    mark: 'line',
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'revenue', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }
}

function summarizeCurrentWindow() {
  const wrapperState = state.wrapper?.getState?.() || {}
  const xDomain = wrapperState?.view?.xDomain || null
  const focusedSeries = Array.isArray(wrapperState?.view?.focusedSeries) ? wrapperState.view.focusedSeries : []

  const visibleRows = state.lineRows.filter((row) => {
    const inDomain = !Array.isArray(xDomain) || (row.date >= xDomain[0] && row.date <= xDomain[1])
    const inFocus = focusedSeries.length === 0 || focusedSeries.includes(row.series)
    return inDomain && inFocus
  })

  if (visibleRows.length === 0) {
    return 'No rows remain in the current focused window.'
  }

  const grouped = new Map()
  for (const row of visibleRows) {
    const values = grouped.get(row.series) || []
    values.push(row.revenue)
    grouped.set(row.series, values)
  }

  const books = grouped.get('Books') || []
  const sports = grouped.get('Sports') || []
  if (books.length === 0 || sports.length === 0) {
    return 'Run both structured actions to focus Sports and Books inside the benchmark zoom window.'
  }

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
  const sportsMean = average(sports)
  const booksMean = average(books)
  const ratio = booksMean > 0 ? sportsMean / booksMean : null

  return [
    `Sports averages about ${sportsMean.toFixed(1)} revenue per visible day, while Books averages about ${booksMean.toFixed(1)}.`,
    ratio ? `That puts Sports at roughly ${ratio.toFixed(1)}x the Books revenue level in the current window.` : null,
    `The focused state is represented as a structured line emphasis rather than a pixel-level operation.`,
  ].filter(Boolean).join(' ')
}

function renderActionResult(result = null) {
  if (!result) {
    const widgetRef = state.transport?.widgetRef || 'unknown-widget'
    el('verify-text').textContent = `Page-port transport is ready for ${widgetRef}. No structured action has been executed yet.`
    el('action-json').textContent = ''
    return
  }

  const verified = result?.verification?.result?.verified === false ? 'failed' : 'passed'
  el('verify-text').textContent = `Verification ${verified}. Action: ${result?.actionResult?.actionName || 'unknown'}.`
  el('action-json').textContent = JSON.stringify({
    actionName: result?.actionResult?.actionName || null,
    result: result?.actionResult?.result || null,
    updatedRefs: result?.actionResult?.updatedRefs || null,
    verification: result?.verification?.result || null,
  }, null, 2)
}

function buildActionCallFromCheck(check) {
  const capability = check?.capability
  const target = check?.param_eval?.target || {}

  if (capability === 'view.domain.zoom') {
    return {
      name: 'line.zoomXRegion',
      params: {
        start: target.start,
        end: target.end,
      },
    }
  }

  if (capability === 'line.series.filter') {
    const linesToRemove = Array.isArray(target.lines_to_remove) ? target.lines_to_remove : []
    const focusedLines = state.allCategories.filter((name) => !linesToRemove.includes(name))
    return {
      name: 'line.focusLines',
      params: {
        lines: focusedLines,
        lineField: 'series',
        dimOpacity: 0.18,
      },
    }
  }

  return null
}

function updateNarrative(stepCount) {
  el('chart-subtitle').textContent = stepCount >= 2
    ? 'WidgetInstance applied a benchmark-inspired zoom plus line-focus sequence.'
    : stepCount === 1
      ? 'WidgetInstance applied the benchmark-inspired Q1 zoom action.'
      : 'Baseline ECharts view before any structured widget action is applied.'
  el('analysis-text').textContent = summarizeCurrentWindow()
}

async function mountWidget() {
  state.controller?.dispose?.()
  state.wrapper = createEChartsLineChartWrapper({
    chart: state.chart,
    rows: state.lineRows,
  })

  state.controller = await mountSingleWidgetDemo({
    provider: 'echarts',
    kind: 'line',
    spec: buildLineSpec(state.lineRows),
    view: state.wrapper,
    sessionId: 'demo-echarts-line-82',
  })
  state.transport = await connectSingleWidgetPagePortClient()
}

async function runBenchmark(stepCount) {
  await mountWidget()
  renderActionResult(null)

  let lastResult = null
  const checks = groundTruth().capability_param_checks
  for (let index = 0; index < stepCount; index += 1) {
    const actionCall = buildActionCallFromCheck(checks[index])
    if (!actionCall) continue
    lastResult = await state.transport.executeVerifiedAction(actionCall)
    await Promise.resolve()
  }

  updateNarrative(stepCount)
  renderActionResult(lastResult)
}

async function loadBenchmark() {
  const benchmark = await fetch(BENCHMARK_PATH).then((response) => response.json())
  const dataset = await fetch(`${PACKAGE_ROOT}${benchmark.data_source.dataset_path}`).then((response) => response.json())

  state.benchmark = benchmark
  state.rows = dataset
  state.lineRows = aggregateRows(dataset)
  state.allCategories = [...new Set(state.lineRows.map((entry) => entry.series))]
  state.chart = echarts.init(el('chart'), null, { renderer: 'canvas' })

  const question = benchmarkQuestion()
  el('question').textContent = question.question
  el('partition').textContent = benchmark.benchmark_partition
  el('widget-kind').textContent = benchmark.widget_kind
  el('row-count').textContent = String(benchmark.data_source.row_count)
  el('question-style').textContent = categorizeQuestionStyle(question.question_style)

  const capabilities = el('capabilities')
  capabilities.replaceChildren(...groundTruth().required_capabilities.map((entry) => {
    const li = document.createElement('li')
    li.textContent = entry
    return li
  }))

  const insights = el('insights')
  insights.replaceChildren(...groundTruth().key_insights.map((entry) => {
    const li = document.createElement('li')
    li.textContent = entry
    return li
  }))

  await runBenchmark(0)
}

el('reset').addEventListener('click', () => runBenchmark(0))
el('run-step-1').addEventListener('click', () => runBenchmark(1))
el('run-step-2').addEventListener('click', () => runBenchmark(2))
el('run-all').addEventListener('click', () => runBenchmark(groundTruth().capability_param_checks.length))

loadBenchmark()

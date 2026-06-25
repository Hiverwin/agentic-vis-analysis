import * as echarts from 'https://cdn.jsdelivr.net/npm/echarts@5/+esm'
import { createEChartsScatterChartWrapper } from '../../reference/scatterChartWrapper.js'
import { connectSingleWidgetPagePortClient } from '../../../demoShared/pagePortActionClient.js'
import { mountSingleWidgetDemo } from '../../../demoShared/widgetRuntimeHarness.js'

const PACKAGE_ROOT = '../../../../'
const BENCHMARK_PATH = `${PACKAGE_ROOT}benchmarks/main/vague_single_variants/type2/vague_single/22_scatter_vs_01_type1a_type2.json`

const state = {
  benchmark: null,
  rows: [],
  rowById: new Map(),
  chart: null,
  wrapper: null,
  controller: null,
  transport: null,
}

function el(id) {
  return document.getElementById(id)
}

function benchmarkQuestion() {
  return state.benchmark.question_set[0]
}

function groundTruth() {
  return benchmarkQuestion().ground_truth
}

function categorizeQuestionStyle(style) {
  return style === 'natural_language' ? 'Natural language' : 'Tool hinted'
}

function buildScatterSpec(rows) {
  return {
    data: {
      values: rows,
    },
    mark: 'point',
    encoding: {
      x: { field: 'DistanceFromHome', type: 'quantitative' },
      y: { field: 'MonthlyIncome', type: 'quantitative' },
      color: { field: 'WorkLifeBalance', type: 'nominal' },
    },
  }
}

function buildVisibleRowSummary() {
  const wrapperState = state.wrapper?.getState?.() || {}
  const xDomain = wrapperState?.view?.xDomain || null
  const yDomain = wrapperState?.view?.yDomain || null

  const visibleRows = state.rows.filter((row) => {
    const x = Number(row.DistanceFromHome) || 0
    const y = Number(row.MonthlyIncome) || 0
    const xOkay = !Array.isArray(xDomain) || (x >= xDomain[0] && x <= xDomain[1])
    const yOkay = !Array.isArray(yDomain) || (y >= yDomain[0] && y <= yDomain[1])
    return xOkay && yOkay
  })

  if (visibleRows.length === 0) {
    return 'No employees remain inside the current visible region.'
  }

  const salaryValues = visibleRows.map((row) => Number(row.MonthlyIncome) || 0)
  const minSalary = Math.min(...salaryValues)
  const maxSalary = Math.max(...salaryValues)
  const meanWorkLife = visibleRows.reduce((sum, row) => sum + (Number(row.WorkLifeBalance) || 0), 0) / visibleRows.length

  return [
    `${visibleRows.length} employees remain visible after the current structured zoom.`,
    `Monthly income spans from ${Math.round(minSalary)} to ${Math.round(maxSalary)} in the visible window.`,
    `Average work-life balance inside the window is ${meanWorkLife.toFixed(2)}.`,
  ].join(' ')
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
      name: 'scatter.zoomDomain',
      params: {
        xDomain: target.x_range,
        yDomain: target.y_range,
      },
    }
  }

  return null
}

function updateNarrative(stepCount) {
  el('chart-subtitle').textContent = stepCount >= 1
    ? 'WidgetInstance executed a benchmark-inspired zoom action over the ECharts scatter.'
    : 'Baseline ECharts scatter before any structured widget action is applied.'
  el('analysis-text').textContent = buildVisibleRowSummary()
}

async function mountWidget() {
  state.controller?.dispose?.()
  state.wrapper = createEChartsScatterChartWrapper({
    chart: state.chart,
    rows: state.rows.map((row) => ({
      id: row.EmployeeID,
      x: Number(row.DistanceFromHome) || 0,
      y: Number(row.MonthlyIncome) || 0,
      category: String(row.WorkLifeBalance),
    })),
  })

  state.controller = await mountSingleWidgetDemo({
    provider: 'echarts',
    kind: 'scatter',
    spec: buildScatterSpec(state.rows),
    view: state.wrapper,
    sessionId: 'demo-echarts-scatter-22',
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
  state.rowById = new Map(dataset.map((row) => [row.EmployeeID, row]))
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
el('run-all').addEventListener('click', () => runBenchmark(groundTruth().capability_param_checks.length))

loadBenchmark()

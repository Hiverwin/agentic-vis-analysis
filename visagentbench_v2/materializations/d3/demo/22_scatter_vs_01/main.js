import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'
import { createD3ScatterChartWrapper } from '../../reference/scatterChartWrapper.js'
import { connectSingleWidgetPagePortClient } from '../../../demoShared/pagePortActionClient.js'
import { mountSingleWidgetDemo } from '../../../demoShared/widgetRuntimeHarness.js'

const PACKAGE_ROOT = '../../../../'
const BENCHMARK_PATH = `${PACKAGE_ROOT}benchmarks/main/vague_single_variants/type2/vague_single/22_scatter_vs_01_type1a_type2.json`

const width = 860
const height = 520
const margin = { top: 28, right: 20, bottom: 56, left: 82 }
const plotWidth = width - margin.left - margin.right
const plotHeight = height - margin.top - margin.bottom

const svg = d3.select('#chart')
const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
const layers = {
  grid: root.append('g'),
  marks: root.append('g'),
  axes: root.append('g'),
}

const state = {
  benchmark: null,
  rows: [],
  rowById: new Map(),
  baselineDomain: null,
  wrapper: null,
  controller: null,
  transport: null,
  lastRender: null,
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

function buildAnalysis(points) {
  const visibleIds = points.filter((point) => point.visible).map((point) => point.id)
  const visibleRows = visibleIds.map((id) => state.rowById.get(id)).filter(Boolean)
  if (visibleRows.length === 0) {
    return 'No employees remain inside the current visible region.'
  }

  const meanYears = d3.mean(visibleRows, (row) => row.YearsAtCompany) || 0
  const meanWorkLife = d3.mean(visibleRows, (row) => row.WorkLifeBalance) || 0
  const salaryRange = d3.extent(visibleRows, (row) => row.MonthlyIncome)
  const tenureUnderOneYear = visibleRows.filter((row) => row.YearsAtCompany < 1).length

  return [
    `${visibleRows.length} employees remain visible in the current domain.`,
    `Monthly income spans from ${Math.round(salaryRange[0])} to ${Math.round(salaryRange[1])}.`,
    `Average tenure is ${meanYears.toFixed(1)} years, and ${tenureUnderOneYear} employees have been at the company for less than one year.`,
    `Average work-life balance in the visible window is ${meanWorkLife.toFixed(2)}.`,
  ].join(' ')
}

function renderScatter(payload) {
  state.lastRender = payload

  const xDomain = payload.xDomain || state.baselineDomain.x
  const yDomain = payload.yDomain || state.baselineDomain.y
  const x = d3.scaleLinear().domain(xDomain).range([0, plotWidth]).nice()
  const y = d3.scaleLinear().domain(yDomain).range([plotHeight, 0]).nice()
  const color = d3.scaleLinear().domain([1, 4]).range(['#d8c9b7', '#1f6f78'])

  layers.grid.selectAll('*').remove()
  layers.grid.selectAll('line.horizontal')
    .data(y.ticks(6))
    .join('line')
    .attr('class', 'horizontal')
    .attr('x1', 0)
    .attr('x2', plotWidth)
    .attr('y1', (tick) => y(tick))
    .attr('y2', (tick) => y(tick))
    .attr('stroke', '#e8ddcf')

  layers.axes.selectAll('*').remove()
  layers.axes.append('g')
    .attr('transform', `translate(0,${plotHeight})`)
    .call(d3.axisBottom(x).ticks(6))
  layers.axes.append('g')
    .call(d3.axisLeft(y).ticks(6))
  layers.axes.selectAll('text')
    .attr('fill', '#6a6258')
    .style('font-family', 'Georgia, serif')
  layers.axes.selectAll('path,line')
    .attr('stroke', '#bba994')

  layers.marks.selectAll('*').remove()
  layers.marks.selectAll('circle')
    .data(payload.points)
    .join('circle')
    .attr('cx', (point) => x(point.x))
    .attr('cy', (point) => y(point.y))
    .attr('r', (point) => point.selected ? 5 : 3.2)
    .attr('fill', (point) => color(Number(point.category) || 1))
    .attr('opacity', (point) => point.visible ? 0.68 : 0.12)
    .attr('stroke', (point) => point.selected ? '#1d1a16' : 'none')
    .attr('stroke-width', 1)

  el('analysis-text').textContent = buildAnalysis(payload.points)
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
    params: result?.actionResult?.params || result?.actionResult?.result || null,
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

function updateSubtitle(stepCount) {
  el('chart-subtitle').textContent = stepCount >= 1
    ? 'WidgetInstance executed a benchmark-inspired zoom action over the D3 scatter.'
    : 'Baseline D3 scatter before any structured widget action is applied.'
}

async function mountWidget() {
  state.controller?.dispose?.()
  state.wrapper = createD3ScatterChartWrapper({
    rows: state.rows.map((row) => ({
      id: row.EmployeeID,
      x: Number(row.DistanceFromHome) || 0,
      y: Number(row.MonthlyIncome) || 0,
      category: String(row.WorkLifeBalance),
    })),
    render: renderScatter,
  })

  state.controller = await mountSingleWidgetDemo({
    provider: 'd3',
    kind: 'scatter',
    spec: buildScatterSpec(state.rows),
    view: state.wrapper,
    sessionId: 'demo-d3-scatter-22',
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

  updateSubtitle(stepCount)
  renderActionResult(lastResult)
}

async function loadBenchmark() {
  const benchmark = await fetch(BENCHMARK_PATH).then((response) => response.json())
  const dataset = await fetch(`${PACKAGE_ROOT}${benchmark.data_source.dataset_path}`).then((response) => response.json())

  state.benchmark = benchmark
  state.rows = dataset
  state.rowById = new Map(dataset.map((row) => [row.EmployeeID, row]))
  state.baselineDomain = {
    x: d3.extent(dataset, (row) => Number(row.DistanceFromHome) || 0),
    y: d3.extent(dataset, (row) => Number(row.MonthlyIncome) || 0),
  }

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

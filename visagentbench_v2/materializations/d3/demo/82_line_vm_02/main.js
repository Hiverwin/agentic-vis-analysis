import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'
import { createD3LineChartWrapper } from '../../reference/lineChartWrapper.js'
import { connectSingleWidgetPagePortClient } from '../../../demoShared/pagePortActionClient.js'
import { mountSingleWidgetDemo } from '../../../demoShared/widgetRuntimeHarness.js'

const PACKAGE_ROOT = '../../../../'
const BENCHMARK_PATH = `${PACKAGE_ROOT}benchmarks/main/vague_multi_variants/type2/vague_multi/82_line_vm_02_type1a_type2.json`

const svg = d3.select('#chart')
const width = 860
const height = 520
const margin = { top: 28, right: 20, bottom: 52, left: 72 }
const plotWidth = width - margin.left - margin.right
const plotHeight = height - margin.top - margin.bottom

const layers = {
  root: svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`),
}

layers.grid = layers.root.append('g')
layers.paths = layers.root.append('g')
layers.axes = layers.root.append('g')
layers.focus = layers.root.append('g')

const state = {
  benchmark: null,
  rows: [],
  lineRows: [],
  allCategories: [],
  wrapper: null,
  controller: null,
  transport: null,
  lastRender: null,
  activeStepCount: 0,
}

function el(id) {
  return document.getElementById(id)
}

function fmtNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
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
  const rollup = d3.rollups(
    rows,
    (group) => d3.sum(group, (row) => Number(row['Total Revenue']) || 0),
    (row) => row.Date,
    (row) => row['Product Category'],
  )

  return rollup.flatMap(([date, categoryRows]) =>
    categoryRows.map(([category, revenue]) => ({
      date,
      series: category,
      revenue,
    })),
  )
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

function computeAnalysisText(series) {
  const books = series.find((entry) => entry.key === 'Books')
  const sports = series.find((entry) => entry.key === 'Sports')

  if (!books || !sports) {
    return 'Run both structured actions to focus Sports and Books inside the benchmark zoom window.'
  }

  const mean = (values) => d3.mean(values, (entry) => entry.revenue) || 0
  const deviation = (values) => d3.deviation(values, (entry) => entry.revenue) || 0
  const sportsMean = mean(sports.values)
  const booksMean = mean(books.values)
  const sportsDev = deviation(sports.values)
  const booksDev = deviation(books.values)
  const ratio = booksMean > 0 ? sportsMean / booksMean : null

  return [
    `Sports averages about ${fmtNumber(sportsMean)} revenue per visible day, while Books averages about ${fmtNumber(booksMean)}.`,
    ratio ? `That puts Sports at roughly ${fmtNumber(ratio)}x the Books revenue level in the benchmark window.` : null,
    `Sports also shows wider day-to-day jitter (${fmtNumber(sportsDev)} standard deviation) versus Books (${fmtNumber(booksDev)}).`,
  ].filter(Boolean).join(' ')
}

function renderLegend(series, color) {
  const legend = d3.select('#legend')
  legend.selectAll('*').remove()

  legend.selectAll('div')
    .data(series)
    .join('div')
    .attr('class', 'legend-item')
    .html((entry) => `
      <span class="legend-swatch" style="background:${color(entry.key)}"></span>
      <span>${entry.key}</span>
    `)
}

function renderSteps() {
  const stepRoot = d3.select('#steps')
  stepRoot.selectAll('*').remove()

  stepRoot.selectAll('div')
    .data(groundTruth().reasoning_trace)
    .join('div')
    .attr('class', (entry, index) => `step-card${index < state.activeStepCount ? ' active' : ''}`)
    .html((entry, index) => `
      <p class="step-title">Step ${index + 1}: <strong>${entry.capability}</strong></p>
      <p class="step-rationale">${entry.rationale}</p>
    `)
}

function updateSubtitle(stepCount = state.activeStepCount) {
  el('chart-subtitle').textContent = stepCount >= 2
    ? 'WidgetInstance applied a benchmark-inspired zoom plus line-focus sequence.'
    : stepCount === 1
      ? 'WidgetInstance applied the benchmark-inspired Q1 zoom action.'
      : 'Baseline D3 view before any structured widget action is applied.'
}

function renderLine(payload) {
  state.lastRender = payload

  const series = payload.series.map((entry) => ({
    ...entry,
    values: entry.values.map((point) => ({
      ...point,
      date: new Date(point.date),
    })),
  }))
  const allVisiblePoints = series.flatMap((entry) => entry.values)
  const xExtent = payload.xDomain
    ? payload.xDomain.map((value) => new Date(value))
    : d3.extent(state.lineRows, (entry) => new Date(entry.date))
  const yMax = d3.max(allVisiblePoints, (entry) => entry.revenue) || 0

  const x = d3.scaleTime().domain(xExtent).range([0, plotWidth])
  const y = d3.scaleLinear().domain([0, yMax * 1.08]).nice().range([plotHeight, 0])
  const color = d3.scaleOrdinal()
    .domain(state.allCategories)
    .range(['#b3522f', '#1f6f78', '#8a6f41', '#476a30', '#925f9b', '#3a4f7a'])

  const line = d3.line()
    .x((entry) => x(entry.date))
    .y((entry) => y(entry.revenue))
    .curve(d3.curveCatmullRom.alpha(0.4))

  layers.grid.selectAll('*').remove()
  layers.grid.selectAll('line')
    .data(y.ticks(6))
    .join('line')
    .attr('x1', 0)
    .attr('x2', plotWidth)
    .attr('y1', (tick) => y(tick))
    .attr('y2', (tick) => y(tick))
    .attr('stroke', '#e8ddcf')
    .attr('stroke-width', 1)

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

  layers.paths.selectAll('*').remove()
  layers.paths.selectAll('path')
    .data(series)
    .join('path')
    .attr('fill', 'none')
    .attr('stroke', (entry) => color(entry.key))
    .attr('stroke-width', (entry) => entry.highlighted ? 3.2 : 1.8)
    .attr('opacity', (entry) => entry.dimmed ? 0.18 : 0.92)
    .attr('d', (entry) => line(entry.values))

  layers.focus.selectAll('*').remove()
  const emphasized = series.filter((entry) => entry.highlighted || !entry.dimmed)
  if (state.activeStepCount >= 2) {
    layers.focus.selectAll('text')
      .data(emphasized.filter((entry) => entry.values.length > 0))
      .join('text')
      .attr('x', (entry) => x(entry.values[entry.values.length - 1].date) + 8)
      .attr('y', (entry) => y(entry.values[entry.values.length - 1].revenue))
      .attr('fill', (entry) => color(entry.key))
      .style('font-size', '13px')
      .style('font-weight', '700')
      .text((entry) => entry.key)
  }

  renderLegend(series, color)
  renderSteps()
  updateSubtitle()

  el('analysis-text').textContent = computeAnalysisText(series)
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

async function mountWidget() {
  state.controller?.dispose?.()
  state.wrapper = createD3LineChartWrapper({
    rows: state.lineRows,
    render: renderLine,
  })

  state.controller = await mountSingleWidgetDemo({
    provider: 'd3',
    kind: 'line',
    spec: buildLineSpec(state.lineRows),
    view: state.wrapper,
    sessionId: 'demo-d3-line-82',
  })
  state.transport = await connectSingleWidgetPagePortClient()
}

async function runBenchmark(stepCount) {
  state.activeStepCount = 0
  await mountWidget()
  renderActionResult(null)

  let lastResult = null
  const checks = groundTruth().capability_param_checks
  for (let index = 0; index < stepCount; index += 1) {
    const actionCall = buildActionCallFromCheck(checks[index])
    if (!actionCall) continue
    lastResult = await state.transport.executeVerifiedAction(actionCall)
    state.activeStepCount = index + 1
    await Promise.resolve()
  }

  updateSubtitle(stepCount)
  renderSteps()
  renderActionResult(lastResult)
}

async function loadBenchmark() {
  const benchmark = await fetch(BENCHMARK_PATH).then((response) => response.json())
  const dataset = await fetch(`${PACKAGE_ROOT}${benchmark.data_source.dataset_path}`).then((response) => response.json())

  state.benchmark = benchmark
  state.rows = dataset
  state.lineRows = aggregateRows(dataset)
  state.allCategories = [...new Set(state.lineRows.map((entry) => entry.series))]

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

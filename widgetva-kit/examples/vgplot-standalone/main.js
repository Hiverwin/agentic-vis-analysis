import {
  buildVgplotVerificationEvidence,
  executeVgplotAction,
  installVgplotRuntimeAssembly,
  orchestrateVgplotView,
  queryVgplotPerception,
  readVgplotState,
} from '../../src/adapters/index.js'
import { runNaturalLanguagePagePortAgentSession } from '../../src/core/index.js'
import {
  createOpenRouterChatCompleter,
  createStandaloneAgentPort,
  createVisibleRowsReader,
} from './agentRuntime.js'
import { createVgplotController } from '../../src/adapters/vgplot/vgplotController.js'

const rows = [
  { name: 'Ford Pinto', horsepower: 75, mpg: 27, origin: 'USA' },
  { name: 'Toyota Corolla', horsepower: 65, mpg: 31, origin: 'Japan' },
  { name: 'BMW 2002', horsepower: 113, mpg: 26, origin: 'Europe' },
  { name: 'Merc 230', horsepower: 95, mpg: 22, origin: 'Europe' },
  { name: 'Datsun 710', horsepower: 97, mpg: 24, origin: 'Japan' },
  { name: 'AMC Gremlin', horsepower: 100, mpg: 19, origin: 'USA' },
  { name: 'Fiat 128', horsepower: 66, mpg: 30, origin: 'Europe' },
  { name: 'Volvo 144', horsepower: 109, mpg: 19, origin: 'Europe' },
  { name: 'Mazda RX-4', horsepower: 110, mpg: 21, origin: 'Japan' },
  { name: 'Chevrolet Chevelle', horsepower: 130, mpg: 18, origin: 'USA' },
  { name: 'Porsche 914-2', horsepower: 91, mpg: 26, origin: 'Europe' },
  { name: 'Ferrari Dino', horsepower: 175, mpg: 19, origin: 'Europe' },
  { name: 'Ford Pantera L', horsepower: 264, mpg: 16, origin: 'USA' },
  { name: 'Maserati Bora', horsepower: 335, mpg: 15, origin: 'Europe' },
]

function createPlot(initialAttributes = {}) {
  const attributes = new Map(Object.entries(initialAttributes))
  return {
    attributes,
    getAttribute(name) {
      return attributes.get(name)
    },
    setAttribute(name, value) {
      attributes.set(name, value)
    },
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function stringify(value) {
  return JSON.stringify(value, null, 2)
}

function domain(values) {
  return [Math.min(...values), Math.max(...values)]
}

function computeRegression(points = []) {
  if (!Array.isArray(points) || points.length < 2) return null
  const n = points.length
  const xMean = points.reduce((sum, point) => sum + point.horsepower, 0) / n
  const yMean = points.reduce((sum, point) => sum + point.mpg, 0) / n
  const numerator = points.reduce((sum, point) => sum + ((point.horsepower - xMean) * (point.mpg - yMean)), 0)
  const denominator = points.reduce((sum, point) => sum + ((point.horsepower - xMean) ** 2), 0)
  if (!Number.isFinite(denominator) || denominator === 0) return null
  const slope = numerator / denominator
  const intercept = yMean - (slope * xMean)
  return { slope, intercept }
}

function lineForDomain(regression, xDomain) {
  if (!regression || !Array.isArray(xDomain) || xDomain.length !== 2) return null
  const [x1, x2] = xDomain
  return [
    { horsepower: x1, mpg: (regression.slope * x1) + regression.intercept },
    { horsepower: x2, mpg: (regression.slope * x2) + regression.intercept },
  ]
}

const assembly = installVgplotRuntimeAssembly({
  registryId: 'widgetva-vgplot-standalone',
})

const context = assembly.createContext({
  label: 'WidgetVA Standalone Vgplot Context',
}, {
  contextId: 'ctx_widgetva_vgplot_demo',
})

const brushSelection = {
  type: 'intervalXY',
  value: {
    xDomain: [60, 340],
    yDomain: [14, 32],
  },
}

const zoomParam = {
  type: 'panZoom',
  value: {
    xDomain: domain(rows.map((row) => row.horsepower)),
    yDomain: domain(rows.map((row) => row.mpg)),
  },
}

const plot = assembly.registerPlot(createPlot({
  xDomain: domain(rows.map((row) => row.horsepower)),
  yDomain: domain(rows.map((row) => row.mpg)),
  regressionMode: 'off',
}), {
  context,
  plotId: 'cars_scatter_plot',
  widgetKind: 'scatter',
  selections: [['brush', brushSelection]],
  params: [['zoom_xy', zoomParam]],
  configActions: {
    'scatter.showRegression': ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('regressionMode', params?.enabled === false ? 'off' : 'on')
      return true
    },
  },
  configStateKeys: ['regressionMode'],
})

const view = { context }
const controller = createVgplotController({ view })
const binding = {
  widgetRef: 'wl://widgetva-demo/workspace/main/widget/vgplot_scatter',
  dataRef: 'wl://widgetva-demo/workspace/main/data/cars',
  widgetKind: 'scatter',
  selectionNames: ['brush'],
  paramNames: ['zoom_xy'],
  fields: ['horsepower', 'mpg', 'origin'],
  plotBindings: [
    {
      plotId: 'cars_scatter_plot',
      role: 'main',
      xField: 'horsepower',
      yField: 'mpg',
      colorField: 'origin',
    },
  ],
}

orchestrateVgplotView({
  view,
  binding,
  widgetKind: 'scatter',
})

const stateEl = document.querySelector('#provider-state')
const providerVerifyEl = document.querySelector('#provider-verify')
const widgetVerifyEl = document.querySelector('#widget-verify')
const actionLogEl = document.querySelector('#action-log')
const chipsEl = document.querySelector('#workspace-chips')
const scatterSvg = document.querySelector('#scatter-view')
const controlsEl = document.querySelector('#control-groups')
const agentObjectiveEl = document.querySelector('#agent-objective')
const agentModelEl = document.querySelector('#agent-model')
const agentMaxTurnsEl = document.querySelector('#agent-max-turns')
const runAgentButtonEl = document.querySelector('#run-agent-button')
const agentStatusEl = document.querySelector('#agent-status')
const agentResponseEl = document.querySelector('#agent-response')
const agentPromptListEl = document.querySelector('#agent-prompt-list')

let lastProviderVerification = null
let lastWidgetVerification = null
let lastActionLog = null
let lastAgentSession = null

const samplePrompts = [
  '请缩放到 60 到 200 马力、15 到 32 mpg 的区域，然后告诉我当前视图里有多少可见车辆。',
  '请显示当前视图的回归线，并解释 horsepower 和 mpg 的关系。',
  '请聚焦 90 到 160 马力、18 到 28 mpg 的局部区域，并总结这个局部区域的模式。',
]

const readRows = createVisibleRowsReader({
  rows,
  view,
})

const agentPort = createStandaloneAgentPort({
  binding,
  view,
  readRows,
  onRuntimeMutation(event) {
    if (event?.kind === 'action') {
      lastProviderVerification = event.verification || lastProviderVerification
      lastActionLog = {
        actor: 'agent',
        actionName: event.actionName,
        beforeState: event.beforeState,
        afterState: event.afterState,
      }
      agentStatusEl.textContent = `Agent executed ${event.actionName || 'one action'}...`
    }
    if (event?.kind === 'perception') {
      lastProviderVerification = event.response || lastProviderVerification
      lastActionLog = {
        actor: 'agent',
        perceptionName: event.perceptionName,
        response: event.response,
        state: event.state,
      }
      agentStatusEl.textContent = `Agent read ${event.perceptionName || 'one perception'}...`
    }
    render()
  },
})

function currentState() {
  return readVgplotState({ view })
}

function currentRows() {
  return readRows()
}

function renderScatter() {
  const state = currentState()
  const xDomain = state?.viewport?.xDomain || domain(rows.map((row) => row.horsepower))
  const yDomain = state?.viewport?.yDomain || domain(rows.map((row) => row.mpg))
  const plotRows = currentRows()
  const visibleRows = plotRows.filter((row) => row.visible)
  const regressionMode = plot.getAttribute('regressionMode')
  const regression = regressionMode === 'on' ? computeRegression(visibleRows) : null
  const regressionLine = lineForDomain(regression, xDomain)

  const margin = { top: 22, right: 24, bottom: 44, left: 56 }
  const width = 780
  const height = 420
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const scaleX = (value) => margin.left + (((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerWidth)
  const scaleY = (value) => margin.top + (innerHeight - (((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerHeight))

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const x = margin.left + (innerWidth * fraction)
    const y = margin.top + (innerHeight * fraction)
    return `
      <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerHeight}" stroke="#e2ebf5" stroke-width="1" />
      <line x1="${margin.left}" y1="${y}" x2="${margin.left + innerWidth}" y2="${y}" stroke="#e2ebf5" stroke-width="1" />
    `
  }).join('')

  const points = plotRows.map((row) => {
    const fill = row.selected ? '#c6912b' : (row.visible ? '#2f6fb0' : '#8fa9c2')
    const opacity = row.visible ? (row.selected ? 0.95 : 0.85) : 0.24
    return `
      <circle
        cx="${scaleX(row.horsepower)}"
        cy="${scaleY(row.mpg)}"
        r="${row.selected ? 5.5 : 4.5}"
        fill="${fill}"
        fill-opacity="${opacity}"
        stroke="white"
        stroke-width="1.2"
      >
        <title>${row.name} · hp ${row.horsepower} · mpg ${row.mpg}</title>
      </circle>
    `
  }).join('')

  const regressionMarkup = regressionLine
    ? `
      <line
        x1="${scaleX(regressionLine[0].horsepower)}"
        y1="${scaleY(regressionLine[0].mpg)}"
        x2="${scaleX(regressionLine[1].horsepower)}"
        y2="${scaleY(regressionLine[1].mpg)}"
        stroke="#16324f"
        stroke-width="2"
        stroke-dasharray="8 6"
      />
    `
    : ''

  scatterSvg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="white" />
    ${gridLines}
    <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="#9cb1c8" />
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="#9cb1c8" />
    ${regressionMarkup}
    ${points}
  `
}

function renderChips() {
  const state = currentState()
  const rowsInView = currentRows().filter((row) => row.visible)
  const selected = currentRows().filter((row) => row.selected)
  const regressionMode = plot.getAttribute('regressionMode')
  const chips = [
    `viewport: ${state?.viewport?.xDomain?.[0] ?? '-'}..${state?.viewport?.xDomain?.[1] ?? '-'} hp`,
    `${rowsInView.length} visible rows`,
    `${selected.length} selected rows`,
    `regression: ${regressionMode}`,
  ]
  chipsEl.innerHTML = chips.map((label) => `<span class="chip">${label}</span>`).join('')
}

function renderPanels() {
  stateEl.textContent = stringify(currentState())
  providerVerifyEl.textContent = stringify(lastProviderVerification || { info: 'No provider-native verification yet.' })
  widgetVerifyEl.textContent = stringify(lastWidgetVerification || { info: 'No action request yet.' })
  actionLogEl.textContent = stringify(lastActionLog || { info: 'No action executed yet.' })
  agentResponseEl.textContent = stringify(lastAgentSession || { info: 'No agent session yet.' })
}

function render() {
  renderScatter()
  renderChips()
  renderPanels()
}

async function runProviderBackedHumanUpdate(label, mutate) {
  const beforeState = currentState()
  mutate(beforeState)
  const afterState = currentState()
  lastProviderVerification = buildVgplotVerificationEvidence({
    actionName: label,
    beforeState,
    afterState,
  })
  lastWidgetVerification = {
    info: 'Human runtime mutation does not create a WidgetVA action record, so canonical widget verification is intentionally skipped here.',
  }
  lastActionLog = {
    actor: 'human',
    label,
    beforeState,
    afterState,
  }
  render()
}

async function runAgentAction(actionName, params) {
  const beforeState = currentState()
  const ok = executeVgplotAction({
    widgetKind: 'scatter',
    actionName,
    params,
    view,
  })
  const afterState = currentState()
  lastProviderVerification = queryVgplotPerception({
    perceptionName: 'provider.inspectVerification',
    actionName,
    beforeState,
    view,
  })
  lastWidgetVerification = {
    mode: 'canonical_action_request',
    ok,
    actionName,
    params,
    summary: ok
      ? 'Canonical action was routed into the provider-native vgplot executor.'
      : 'Provider-native vgplot executor rejected this canonical action for the current runtime.',
  }
  lastActionLog = {
    actor: 'agent',
    actionName,
    params,
    actionResult: {
      ok,
      executionSurface: 'provider-native-vgplot',
    },
    beforeState,
    afterState,
  }
  render()
}

async function runNaturalLanguageAgent(objective) {
  const normalizedObjective = typeof objective === 'string' ? objective.trim() : ''
  if (!normalizedObjective) {
    agentStatusEl.textContent = 'Please enter an objective first.'
    return
  }

  const model = typeof agentModelEl?.value === 'string' && agentModelEl.value.trim().length > 0
    ? agentModelEl.value.trim()
    : 'deepseek/deepseek-v4-flash'
  const maxTurns = Number.parseInt(agentMaxTurnsEl?.value || '3', 10)
  const completeChat = createOpenRouterChatCompleter({
    model,
  })

  runAgentButtonEl.disabled = true
  agentStatusEl.textContent = 'Running model-backed agent session...'

  try {
    const session = await runNaturalLanguagePagePortAgentSession(agentPort, {
      objective: normalizedObjective,
      completeChat,
      model,
      maxTurns: Number.isFinite(maxTurns) && maxTurns > 0 ? maxTurns : 3,
    })
    lastAgentSession = session
    lastProviderVerification = session?.turns?.at(-1)?.verify || lastProviderVerification
    lastWidgetVerification = {
      mode: 'model_backed_agent_session',
      ok: session?.ok ?? false,
      stopReason: session?.stopReason || null,
      answer: session?.answer || '',
      turns: Array.isArray(session?.turns) ? session.turns.length : 0,
    }
    lastActionLog = session?.turns?.at(-1)?.act || lastActionLog
    agentStatusEl.textContent = session?.ok
      ? 'Agent session completed.'
      : `Agent session stopped with status: ${session?.stopReason || 'unknown'}.`
    render()
  } catch (error) {
    lastAgentSession = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    agentStatusEl.textContent = 'Agent session failed.'
    render()
  } finally {
    runAgentButtonEl.disabled = false
  }
}

function defineAgentPromptButtons() {
  agentPromptListEl.innerHTML = samplePrompts
    .map((prompt, index) => `<button type="button" class="prompt-chip" data-agent-prompt="${index}">${prompt}</button>`)
    .join('')

  samplePrompts.forEach((prompt, index) => {
    document.querySelector(`[data-agent-prompt="${index}"]`)?.addEventListener('click', () => {
      agentObjectiveEl.value = prompt
    })
  })
}

function defineControls() {
  const groups = [
    {
      title: 'Human Runtime Mutation',
      description: 'These controls mutate provider-native state directly, as if a page-native interactor wrote into the vgplot runtime.',
      buttons: [
        {
          label: 'Brush Mid-Horsepower Region',
          onClick: () => runProviderBackedHumanUpdate('human.brushRegion', () => {
            controller.updateSelection('brush', {
              type: 'intervalXY',
              value: {
                xDomain: [90, 180],
                yDomain: [18, 28],
              },
            })
          }),
        },
        {
          label: 'Zoom To Compact View',
          onClick: () => runProviderBackedHumanUpdate('human.zoomDomain', () => {
            controller.setPlotAttribute('cars_scatter_plot', 'xDomain', [60, 200])
            controller.setPlotAttribute('cars_scatter_plot', 'yDomain', [15, 32])
            controller.updateParam('zoom_xy', {
              type: 'panZoom',
              value: {
                xDomain: [60, 200],
                yDomain: [15, 32],
              },
            })
          }),
        },
        {
          label: 'Reset Human State',
          onClick: () => runProviderBackedHumanUpdate('human.reset', () => {
            controller.updateSelection('brush', {
              type: 'intervalXY',
              value: {
                xDomain: [60, 340],
                yDomain: [14, 32],
              },
            })
            controller.setPlotAttribute('cars_scatter_plot', 'xDomain', domain(rows.map((row) => row.horsepower)))
            controller.setPlotAttribute('cars_scatter_plot', 'yDomain', domain(rows.map((row) => row.mpg)))
            controller.updateParam('zoom_xy', {
              type: 'panZoom',
              value: {
                xDomain: domain(rows.map((row) => row.horsepower)),
                yDomain: domain(rows.map((row) => row.mpg)),
              },
            })
            plot.setAttribute('regressionMode', 'off')
          }),
        },
      ],
    },
    {
      title: 'Agent Through WidgetVA',
      description: 'These controls send canonical action names into the vgplot provider executor, then we read provider-native verification evidence back from the runtime.',
      buttons: [
        {
          label: 'Agent: Select Dense Region',
          onClick: () => runAgentAction('scatter.selectRegion', {
            xField: 'horsepower',
            yField: 'mpg',
            xRange: [90, 160],
            yRange: [18, 28],
          }),
        },
        {
          label: 'Agent: Zoom View',
          onClick: () => runAgentAction('scatter.zoomDomain', {
            xDomain: [60, 200],
            yDomain: [15, 32],
          }),
        },
        {
          label: 'Agent: Show Regression',
          onClick: () => runAgentAction('scatter.showRegression', {
            enabled: true,
          }),
        },
      ],
    },
  ]

  controlsEl.innerHTML = groups.map((group, groupIndex) => `
    <section class="control-group" data-group="${groupIndex}">
      <h3>${group.title}</h3>
      <p>${group.description}</p>
      ${group.buttons.map((button, buttonIndex) => `
        <button type="button" data-group-button="${groupIndex}:${buttonIndex}">${button.label}</button>
      `).join('')}
    </section>
  `).join('')

  groups.forEach((group, groupIndex) => {
    group.buttons.forEach((button, buttonIndex) => {
      const element = document.querySelector(`[data-group-button="${groupIndex}:${buttonIndex}"]`)
      element?.addEventListener('click', () => {
        button.onClick()
      })
    })
  })
}

defineControls()
defineAgentPromptButtons()
runAgentButtonEl?.addEventListener('click', () => {
  runNaturalLanguageAgent(agentObjectiveEl?.value || '')
})
render()

window.__widgetvaVgplotStandalone = {
  rows: clone(rows),
  view,
  plot,
  context,
  controller,
  readState: () => readVgplotState({ view }),
  inspectProviderVerification(options = {}) {
    return queryVgplotPerception({
      perceptionName: 'provider.inspectVerification',
      view,
      ...options,
    })
  },
  runAgentAction,
  runNaturalLanguageAgent,
  agentPort,
}

import {
  executeVgplotAction,
} from '../../src/adapters/vgplot/vgplotActionRouter.js'
import {
  queryVgplotPerception,
} from '../../src/adapters/vgplot/vgplotPerceptionQueries.js'
import {
  readVgplotState,
} from '../../src/adapters/vgplot/vgplotState.js'
import {
  resolveVgplotCapabilities,
} from '../../src/adapters/vgplot/vgplotCapabilityResolver.js'

let stateCounter = 0

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function domain(values) {
  return [Math.min(...values), Math.max(...values)]
}

function normalizeRange(range = null, fallback = null) {
  return Array.isArray(range) && range.length === 2 ? range : fallback
}

function readSelectionBounds(state = null) {
  const selectionValue = state?.selection?.value
  return {
    xDomain: Array.isArray(selectionValue?.xDomain) ? selectionValue.xDomain : null,
    yDomain: Array.isArray(selectionValue?.yDomain) ? selectionValue.yDomain : null,
  }
}

function computePearsonCorrelation(rows = [], xField = 'horsepower', yField = 'mpg') {
  if (!Array.isArray(rows) || rows.length < 2) return null
  const validRows = rows.filter((row) => Number.isFinite(row?.[xField]) && Number.isFinite(row?.[yField]))
  if (validRows.length < 2) return null
  const xMean = validRows.reduce((sum, row) => sum + row[xField], 0) / validRows.length
  const yMean = validRows.reduce((sum, row) => sum + row[yField], 0) / validRows.length
  const numerator = validRows.reduce((sum, row) => sum + ((row[xField] - xMean) * (row[yField] - yMean)), 0)
  const xVariance = validRows.reduce((sum, row) => sum + ((row[xField] - xMean) ** 2), 0)
  const yVariance = validRows.reduce((sum, row) => sum + ((row[yField] - yMean) ** 2), 0)
  const denominator = Math.sqrt(xVariance * yVariance)
  if (!Number.isFinite(denominator) || denominator === 0) return null
  return numerator / denominator
}

export function createVisibleRowsReader({
  rows = [],
  view = null,
  xField = 'horsepower',
  yField = 'mpg',
} = {}) {
  const allRows = Array.isArray(rows) ? clone(rows) : []
  const fallbackXDomain = allRows.length > 0 ? domain(allRows.map((row) => row[xField])) : null
  const fallbackYDomain = allRows.length > 0 ? domain(allRows.map((row) => row[yField])) : null

  return function readRows() {
    const state = readVgplotState({ view })
    const viewportX = normalizeRange(state?.viewport?.xDomain, fallbackXDomain)
    const viewportY = normalizeRange(state?.viewport?.yDomain, fallbackYDomain)
    const selectionBounds = readSelectionBounds(state)
    return allRows.map((row) => {
      const visible = (
        (!viewportX || (row[xField] >= viewportX[0] && row[xField] <= viewportX[1]))
        && (!viewportY || (row[yField] >= viewportY[0] && row[yField] <= viewportY[1]))
      )
      const selected = visible
        && (!selectionBounds.xDomain || (row[xField] >= selectionBounds.xDomain[0] && row[xField] <= selectionBounds.xDomain[1]))
        && (!selectionBounds.yDomain || (row[yField] >= selectionBounds.yDomain[0] && row[yField] <= selectionBounds.yDomain[1]))
      return {
        ...row,
        visible,
        selected,
      }
    })
  }
}

function buildWorkspaceDescription(binding = null) {
  return {
    workspaceId: 'widgetva-vgplot-standalone',
    widgets: [
      {
        ref: binding?.widgetRef || 'wl://widgetva-demo/workspace/main/widget/vgplot_scatter',
        widgetId: 'vgplot_scatter',
        kind: binding?.widgetKind || 'scatter',
        title: 'Scatter Runtime Harness',
        role: 'primary',
      },
    ],
  }
}

function buildObservation({ binding = null, view = null, readRows = null } = {}) {
  const state = readVgplotState({ view })
  const rows = typeof readRows === 'function' ? readRows() : []
  const visibleRows = rows.filter((row) => row.visible)
  const selectedRows = rows.filter((row) => row.selected)
  return {
    state: {
      stateId: `vgplot-standalone:s${stateCounter}`,
    },
    widgetState: clone(state),
    sharedAnalyticalState: {
      focusedWidgetRef: binding?.widgetRef || null,
      filters: {},
      viewport: clone(state?.viewport || null),
      selections: {
        primary: state?.selection ? clone(state.selection) : null,
      },
      highlight: {
        activeWidgetRefs: [],
      },
      comparisonTargets: [],
    },
    derived: {
      visibleCount: visibleRows.length,
      selectedCount: selectedRows.length,
    },
  }
}

function buildActionCatalog(binding = null, view = null) {
  const capabilities = resolveVgplotCapabilities({
    widgetKind: binding?.widgetKind || 'scatter',
    view,
  })
  return (Array.isArray(capabilities?.supportedActionNames) ? capabilities.supportedActionNames : [])
    .map((name) => ({
      name,
      title: name,
      description: `Provider-native vgplot action for ${name}.`,
      queryScope: {
        widgetRef: binding?.widgetRef || null,
      },
    }))
}

function buildPerceptionCatalog(binding = null) {
  return [
    {
      name: 'perception.computeCorrelation',
      title: 'Compute correlation on visible rows',
      description: 'Compute the Pearson correlation between horsepower and mpg over the currently visible rows.',
      queryScope: {
        widgetRef: binding?.widgetRef || null,
      },
    },
    {
      name: 'perception.summarizeVisibleRows',
      title: 'Summarize visible rows',
      description: 'Summarize the currently visible rows and selected rows in the scatter view.',
      queryScope: {
        widgetRef: binding?.widgetRef || null,
      },
    },
    {
      name: 'provider.inspectSelection',
      title: 'Inspect provider selection',
      description: 'Read the current provider-native selection state.',
      queryScope: {
        widgetRef: binding?.widgetRef || null,
      },
    },
    {
      name: 'provider.inspectViewport',
      title: 'Inspect provider viewport',
      description: 'Read the current provider-native viewport state.',
      queryScope: {
        widgetRef: binding?.widgetRef || null,
      },
    },
    {
      name: 'provider.inspectBinding',
      title: 'Inspect provider binding',
      description: 'Read binding metadata attached to the view.',
      queryScope: {
        widgetRef: binding?.widgetRef || null,
      },
    },
  ]
}

function summarizeVisibleRows(rows = []) {
  const visibleRows = rows.filter((row) => row.visible)
  const selectedRows = rows.filter((row) => row.selected)
  const origins = [...new Set(visibleRows.map((row) => row.origin).filter(Boolean))]
  return {
    visibleCount: visibleRows.length,
    selectedCount: selectedRows.length,
    visibleNames: visibleRows.map((row) => row.name),
    selectedNames: selectedRows.map((row) => row.name),
    origins,
  }
}

function buildPerceptionResult(name, {
  binding = null,
  view = null,
  readRows = null,
} = {}) {
  if (name?.startsWith('provider.')) {
    return queryVgplotPerception({
      perceptionName: name,
      view,
    })
  }

  const rows = typeof readRows === 'function' ? readRows() : []
  if (name === 'perception.summarizeVisibleRows') {
    const summary = summarizeVisibleRows(rows)
    return {
      ok: true,
      summary: `There are ${summary.visibleCount} visible rows and ${summary.selectedCount} selected rows.`,
      result: summary,
    }
  }
  if (name === 'perception.computeCorrelation') {
    const visibleRows = rows.filter((row) => row.visible)
    const correlation = computePearsonCorrelation(visibleRows)
    return {
      ok: correlation != null,
      summary: correlation == null
        ? 'Not enough visible rows to compute correlation.'
        : `The visible horsepower/mpg correlation is ${correlation.toFixed(3)} over ${visibleRows.length} rows.`,
      result: {
        correlation,
        sampleSize: visibleRows.length,
        widgetRef: binding?.widgetRef || null,
      },
    }
  }

  return {
    ok: false,
    summary: `Unsupported perception: ${name}`,
    result: null,
  }
}

export function createStandaloneAgentPort({
  binding = null,
  view = null,
  readRows = null,
  onRuntimeMutation = null,
} = {}) {
  const workspace = buildWorkspaceDescription(binding)
  const actions = buildActionCatalog(binding, view)
  const perceptions = buildPerceptionCatalog(binding)
  let latestCoordinationResult = null

  return {
    async describeWorkspace() {
      return clone(workspace)
    },
    async describeAgentLoop() {
      return {
        loopHints: {
          verifiedActionName: 'executeVerifiedAction',
        },
      }
    },
    async readObservation() {
      return buildObservation({ binding, view, readRows })
    },
    async listAvailableActions() {
      return clone(actions)
    },
    async listAvailablePerceptions() {
      return clone(perceptions)
    },
    async describeActionUsage({ actionName, targetRef }) {
      const entry = actions.find((action) => action.name === actionName) || null
      return {
        actions: entry ? [clone(entry)] : [],
        recommendedCall: entry
          ? {
              name: actionName,
              queryScope: {
                widgetRef: targetRef || binding?.widgetRef || null,
              },
            }
          : null,
      }
    },
    async executeVerifiedAction(call = {}) {
      const beforeState = readVgplotState({ view })
      const ok = executeVgplotAction({
        widgetKind: binding?.widgetKind || 'scatter',
        actionName: call?.name || null,
        params: clone(call?.params || {}),
        view,
      })
      stateCounter += 1
      const afterState = readVgplotState({ view })
      const verificationResponse = queryVgplotPerception({
        perceptionName: 'provider.inspectVerification',
        actionName: call?.name || null,
        beforeState,
        view,
      })
      latestCoordinationResult = {
        verification: clone(verificationResponse?.result || verificationResponse),
        state: clone(afterState),
      }
      if (typeof onRuntimeMutation === 'function') {
        onRuntimeMutation({
          kind: 'action',
          actionName: call?.name || null,
          beforeState: clone(beforeState),
          afterState: clone(afterState),
          verification: clone(verificationResponse?.result || verificationResponse),
        })
      }
      return {
        ok: Boolean(ok) && Boolean(verificationResponse?.result?.ok ?? verificationResponse?.ok),
        actionResult: {
          ok: Boolean(ok),
          stateId: `vgplot-standalone:s${stateCounter}`,
          updatedRefs: [binding?.widgetRef || null].filter(Boolean),
        },
        verification: clone(verificationResponse?.result || verificationResponse),
      }
    },
    async queryPerception(call = {}) {
      const response = buildPerceptionResult(call?.name, {
        binding,
        view,
        readRows,
      })
      latestCoordinationResult = clone(response)
      if (typeof onRuntimeMutation === 'function') {
        onRuntimeMutation({
          kind: 'perception',
          perceptionName: call?.name || null,
          state: clone(readVgplotState({ view })),
          response: clone(response),
        })
      }
      return response
    },
    async readLatestCoordinationResult() {
      return clone(latestCoordinationResult)
    },
  }
}

export function createOpenRouterChatCompleter({
  endpoint = '/api/openrouter/chat',
  model = 'deepseek/deepseek-v4-flash',
  temperature = 0.2,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('createOpenRouterChatCompleter requires fetch().')
  }

  return async function completeChat({ messages = [] } = {}) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: Array.isArray(messages) ? messages : [],
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || 'OpenRouter request failed.')
    }
    return {
      raw: payload,
      content: payload?.choices?.[0]?.message?.content || '',
    }
  }
}

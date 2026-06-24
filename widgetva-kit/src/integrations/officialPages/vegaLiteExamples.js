import { createProviderFamilyAdapter } from '../../adapters/widgetFamilies/index.js'
import { applySelectionToSpec } from '../../core/runtime/materializers/widgetStateBuilders.js'
import { installBrowserExtensionBridge } from '../../transports/browserExtensionBridge.js'
import { createWidgetInstance } from '../../widgets/widgetInstance.js'
import { installVegaEmbedCapture, readLatestVegaEmbedCapture } from './vegaEmbedCapture.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function tryParseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function decodeHtmlEntities(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function stripHtmlTags(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, ' '))
}

function collectCodeLikeBlocks(html) {
  if (typeof html !== 'string' || html.length === 0) return []
  const matches = []
  const patterns = [
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
  ]

  for (const pattern of patterns) {
    let match = pattern.exec(html)
    while (match) {
      matches.push(decodeHtmlEntities(match[1] || ''))
      match = pattern.exec(html)
    }
  }

  return matches
}

function extractBalancedJsonObject(source, startIndex) {
  if (typeof source !== 'string' || startIndex < 0 || startIndex >= source.length || source[startIndex] !== '{') {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function findSchemaAnchoredJson(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  const schemaNeedles = ['"$schema"', '\'${schema}\'', 'https://vega.github.io/schema/vega-lite']

  for (const needle of schemaNeedles) {
    let fromIndex = 0
    while (fromIndex < text.length) {
      const hitIndex = text.indexOf(needle, fromIndex)
      if (hitIndex === -1) break

      for (let cursor = hitIndex; cursor >= 0; cursor -= 1) {
        if (text[cursor] !== '{') continue
        const candidate = extractBalancedJsonObject(text, cursor)
        if (!candidate) continue
        try {
          const parsed = JSON.parse(candidate)
          if (typeof parsed?.$schema === 'string' && parsed.$schema.includes('vega-lite')) {
            return parsed
          }
        } catch {}
      }

      fromIndex = hitIndex + needle.length
    }
  }

  return null
}

function absolutizeDataUrls(node, pageUrl, inDataScope = false) {
  if (Array.isArray(node)) {
    return node.map((entry) => absolutizeDataUrls(entry, pageUrl, inDataScope))
  }
  if (!node || typeof node !== 'object') {
    return node
  }

  const next = {}
  for (const [key, value] of Object.entries(node)) {
    if (inDataScope && key === 'url' && typeof value === 'string') {
      try {
        next[key] = new URL(value, pageUrl).href
      } catch {
        next[key] = value
      }
      continue
    }
    next[key] = absolutizeDataUrls(value, pageUrl, key === 'data')
  }
  return next
}

function createOfficialPageHostBridge({ sessionId, baselineSpec, currentSpecRef, userIntent = null }) {
  return {
    subscribe: () => () => {},
    readSessionId: () => sessionId,
    readBaselineSpec: () => clone(baselineSpec),
    readCurrentSpec: () => clone(currentSpecRef.current),
    writeCurrentSpec(nextSpec) {
      currentSpecRef.current = clone(nextSpec)
    },
    readWorkspaceSpec: () => null,
    readPlanningRequest: () => null,
    readRunMode: () => 'goal_oriented',
    readUserIntent: () => userIntent,
    readCurrentSelection: () => null,
    readCurrentSelections: () => ({}),
    readFocusedWidgetRef: () => null,
    readComparisonTargets: () => [],
    readWorkspaceAnnotations: () => [],
  }
}

function createMutableViewProxy(viewRef) {
  const methodNames = [
    'signal',
    'runAsync',
    'addSignalListener',
    'removeSignalListener',
    'addEventListener',
    'removeEventListener',
    'finalize',
  ]

  const proxy = {}
  for (const methodName of methodNames) {
    proxy[methodName] = (...args) => viewRef.current?.[methodName]?.(...args)
  }
  return proxy
}

function createOfficialPageMaterializer({
  root,
  capture = null,
  currentSpecRef,
  renderedSpecRef,
  viewRef,
}) {
  const source = capture?.source || null
  const target = capture?.target || null
  const options = capture?.options

  if (source === 'embedExample' && typeof root?.embedExample === 'function' && target != null) {
    return async function rematerializeThroughEmbedExample(nextSpecOverride = null) {
      const nextSpec = clone(nextSpecOverride || currentSpecRef.current)
      if (deepEqual(renderedSpecRef.current, nextSpec)) {
        return viewRef.current
      }

      const previousView = viewRef.current
      const nextView = await root.embedExample(target, nextSpec, options)
      viewRef.current = nextView || previousView
      renderedSpecRef.current = clone(nextSpec)
      if (previousView && previousView !== nextView) {
        try {
          previousView.finalize?.()
        } catch {}
      }
      return viewRef.current
    }
  }

  if (source === 'vegaEmbed' && typeof root?.vegaEmbed === 'function' && target != null) {
    return async function rematerializeThroughVegaEmbed(nextSpecOverride = null) {
      const nextSpec = clone(nextSpecOverride || currentSpecRef.current)
      if (deepEqual(renderedSpecRef.current, nextSpec)) {
        return viewRef.current
      }

      const previousView = viewRef.current
      const result = await root.vegaEmbed(target, nextSpec, options)
      const nextView = result?.view || previousView
      viewRef.current = nextView
      renderedSpecRef.current = clone(nextSpec)
      if (previousView && previousView !== nextView) {
        try {
          previousView.finalize?.()
        } catch {}
      }
      return viewRef.current
    }
  }

  return async function noOpMaterialize() {
    return viewRef.current
  }
}

function normalizeWidgetSelections(state) {
  return Object.values(state?.selections || {}).filter(Boolean)
}

function resolveSelectionMaterializationRows({ semanticSpec, state, runtime }) {
  if (Array.isArray(semanticSpec?.data?.values)) {
    return clone(semanticSpec.data.values)
  }

  const dataRef = state?.data?.currentDataRef || state?.data?.sourceDataRef || null
  const runtimeRows = dataRef ? runtime?.store?.readRuntimeData?.(dataRef)?.rows : null
  return Array.isArray(runtimeRows) ? clone(runtimeRows) : null
}

function buildOfficialPageRenderSpec({
  semanticSpec,
  state,
  runtime,
}) {
  const baseSpec = clone(semanticSpec)
  const activeSelections = normalizeWidgetSelections(state)
  if (!baseSpec || activeSelections.length === 0) {
    return baseSpec
  }

  const rows = resolveSelectionMaterializationRows({
    semanticSpec: baseSpec,
    state,
    runtime,
  })
  if (!Array.isArray(rows) || rows.length === 0) {
    return baseSpec
  }

  const nextSpec = {
    ...baseSpec,
    data: {
      values: rows,
    },
  }

  return applySelectionToSpec({
    widgetSpec: nextSpec,
    activeSelections,
    selectionEnabled: true,
  })
}

export function isVegaLiteExamplesPage(pageUrl) {
  const parsedUrl = tryParseUrl(pageUrl)
  if (!parsedUrl) return false
  return (
    parsedUrl.hostname === 'vega.github.io'
    && parsedUrl.pathname.startsWith('/vega-lite/examples/')
    && parsedUrl.pathname.endsWith('.html')
  )
}

export function inferWidgetKindFromVegaLiteSpec(spec) {
  if (spec?.kind === 'table') return 'table'
  if (spec?.kind === 'parallelCoordinates') return 'parallelCoordinates'
  if (spec?.kind === 'sankey') return 'sankey'
  if (spec?.kind === 'map') return 'map'
  const mark = typeof spec?.mark === 'string' ? spec.mark : spec?.mark?.type
  if (mark === 'bar') return 'bar'
  if (mark === 'line') return 'line'
  if (mark === 'point' || mark === 'circle') return 'scatter'
  if (mark === 'rect') return 'heatmap'
  return 'custom'
}

export function extractVegaLiteExampleSpecFromText(text) {
  return findSchemaAnchoredJson(text)
}

export function extractVegaLiteExampleSpecFromHtml(html) {
  const codeBlocks = collectCodeLikeBlocks(html)
  for (const block of codeBlocks) {
    const spec = extractVegaLiteExampleSpecFromText(block)
    if (spec) return spec
  }
  return extractVegaLiteExampleSpecFromText(stripHtmlTags(html))
}

export function normalizeVegaLiteExampleSpec(spec, pageUrl) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('normalizeVegaLiteExampleSpec requires a Vega-Lite spec object.')
  }
  const effectivePageUrl = typeof pageUrl === 'string' && pageUrl.length > 0 ? pageUrl : null
  return effectivePageUrl ? absolutizeDataUrls(clone(spec), effectivePageUrl) : clone(spec)
}

export function readVegaLiteExampleIntegrationInput({
  html = '',
  text = '',
  pageUrl = '',
} = {}) {
  if (!isVegaLiteExamplesPage(pageUrl)) {
    throw new Error(`Unsupported Vega-Lite examples URL: ${pageUrl}`)
  }

  const parsedSpec = extractVegaLiteExampleSpecFromHtml(html) || extractVegaLiteExampleSpecFromText(text)
  if (!parsedSpec) {
    throw new Error('Unable to extract a Vega-Lite example spec from the provided page content.')
  }

  const spec = normalizeVegaLiteExampleSpec(parsedSpec, pageUrl)
  return {
    provider: 'vega-lite',
    kind: inferWidgetKindFromVegaLiteSpec(spec),
    spec,
    pageUrl,
  }
}

export async function attachWidgetVAToVegaLiteExample({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  view = null,
  capture = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current official Vega-Lite example through WidgetVA structured actions.',
} = {}) {
  if (!view) {
    throw new Error('attachWidgetVAToVegaLiteExample requires a Vega/Vega-Lite view instance.')
  }

  const integrationInput = readVegaLiteExampleIntegrationInput({ html, text, pageUrl })
  const widgetAdapter = createProviderFamilyAdapter(integrationInput.kind, 'vega-lite')
  const baselineSpec = clone(integrationInput.spec)
  const currentSpecRef = { current: clone(integrationInput.spec) }
  const renderedSpecRef = { current: clone(integrationInput.spec) }
  const viewRef = { current: view }
  const proxyView = createMutableViewProxy(viewRef)
  const rematerialize = createOfficialPageMaterializer({
    root,
    capture,
    currentSpecRef,
    renderedSpecRef,
    viewRef,
  })
  const baseApplyState = widgetAdapter.applyState?.bind(widgetAdapter)
  widgetAdapter.applyState = async (args = {}) => {
    if (typeof baseApplyState === 'function') {
      await baseApplyState({
        ...args,
        view: viewRef.current,
      })
    }

    const renderSpec = buildOfficialPageRenderSpec({
      semanticSpec: currentSpecRef.current,
      state: args?.state || null,
      runtime: args?.runtime || widgetAdapter?.runtime || null,
    })
    const specChanged = !deepEqual(renderedSpecRef.current, renderSpec)
    if (specChanged) {
      await rematerialize(renderSpec)
      if (typeof baseApplyState === 'function') {
        await baseApplyState({
          ...args,
          view: viewRef.current,
        })
      }
    }
  }
  const widget = createWidgetInstance({
    widgetAdapter,
    spec: baselineSpec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-vega-lite-${integrationInput.kind}`,
        baselineSpec,
        currentSpecRef,
        userIntent,
      }),
    },
  })

  await widget.mount({ view: proxyView, spec: baselineSpec })

  return {
    ...integrationInput,
    widget,
    widgetAdapter,
    getCurrentSpec() {
      return clone(currentSpecRef.current)
    },
    describeAgentContract() {
      return widget.describeAgentContract()
    },
    dispose() {
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToCapturedVegaLiteExample({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
} = {}) {
  const latestCapture = readLatestVegaEmbedCapture(root)
  const view = latestCapture?.view || latestCapture?.result?.view || null
  if (!view) {
    throw new Error('No captured Vega embed view is available on the current page.')
  }

  const fallbackHtml = html || root?.document?.documentElement?.outerHTML || ''
  const fallbackText = text || root?.document?.body?.innerText || ''
  const fallbackPageUrl = pageUrl || root?.location?.href || ''

  return attachWidgetVAToVegaLiteExample({
    root,
    html: fallbackHtml,
    text: fallbackText,
    pageUrl: fallbackPageUrl,
    view,
    capture: latestCapture,
    sessionId,
    userIntent,
  })
}

export async function waitForCapturedVegaLiteExample({
  root = globalThis.window,
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const start = Date.now()

  while ((Date.now() - start) <= timeoutMs) {
    const latestCapture = readLatestVegaEmbedCapture(root)
    if (latestCapture?.view || latestCapture?.result?.view) {
      return latestCapture
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(`Timed out waiting for a captured Vega embed view after ${timeoutMs}ms.`)
}

export async function attachWidgetVAToCurrentVegaLiteExamplePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  installVegaEmbedCapture(root)
  await waitForCapturedVegaLiteExample({
    root,
    timeoutMs,
    pollMs,
  })

  return attachWidgetVAToCapturedVegaLiteExample({
    root,
    html,
    text,
    pageUrl,
    sessionId,
    userIntent,
  })
}

export async function bootstrapCurrentVegaLiteExamplePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  enableExtensionBridge = true,
} = {}) {
  const controller = await attachWidgetVAToCurrentVegaLiteExamplePage({
    root,
    html,
    text,
    pageUrl,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || null,
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}

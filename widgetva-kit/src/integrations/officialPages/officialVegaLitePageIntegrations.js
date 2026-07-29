import { cloneJsonValue as clone } from '../../shared/clone.js'
import { createVegaLiteWidgetAdapter } from '../../adapters/vegaLite/VegaLiteWidgetAdapter.js'
import { installBrowserExtensionBridge } from '../../transports/browserExtensionBridge.js'
import {
  readControllerRecoverableState,
  restoreControllerRecoverableState,
} from './officialPageController.js'
import { createOfficialPageHostBridge } from '../../host/hostBridge.js'
import {
  createOfficialPageMaterializer,
} from '../../core/runtime/materializers/providers/vegaLite/vegaLiteOfficialPageMaterializer.js'
import { buildVegaLiteRenderSpecFromRuntimeState } from '../../adapters/vegaLite/renderSpecFromRuntimeState.js'
import { runAgentLoopOnTarget } from '../../core/agent/adapters/agentTargetPort.js'
import { createWidgetInstance } from '../../core/rendering/widgetRuntimeSurface.js'
import { createWidgetWorkspace } from '../../workspace/widgetWorkspace.js'
import {
  createOfficialPageActionDispatchProxy,
  createOfficialPageParamActionDispatcher,
} from './officialVegaLitePageAgentActions.js'
import {
  clearLatestVegaEmbedCapture,
  installVegaEmbedCapture,
  readLatestVegaEmbedCapture,
} from './vegaEmbedCapture.js'
import {
  addHeatmapAxisAliasesToRows,
  extractOfficialVegaLitePageSpecFromHtml,
  extractOfficialVegaLitePageSpecFromText,
  loadOfficialPageDataValues,
  normalizeOfficialVegaLitePageSpec,
  resolveSpecNodeByViewId,
  tryParseUrl,
} from './officialVegaLitePageSpecExtraction.js'
import {
  appendOfficialPageMultiViewActionsToWorkspaceDescription,
  buildOfficialPageExecutableActionDescriptors,
  buildOfficialPageExecutableActionNames,
  readOfficialPageSelectionState,
} from './officialVegaLitePageActionSurface.js'
import {
  inferWidgetKindFromMark,
  isRecord,
  pushUniqueKind,
  uniqueKinds,
} from './officialVegaLiteWidgetKinds.js'
import {
  describeVegaLiteMultiViewInteractions,
  projectVegaLiteMultiViewToWidgetSemantics,
} from './officialVegaLiteMultiViewInteractions.js'

export {
  buildOfficialPageExecutableActionDescriptors,
  buildOfficialPageExecutableActionNames,
  describeVegaLiteMultiViewInteractions,
  extractOfficialVegaLitePageSpecFromHtml,
  extractOfficialVegaLitePageSpecFromText,
  normalizeOfficialVegaLitePageSpec,
  projectVegaLiteMultiViewToWidgetSemantics,
  readOfficialPageSelectionState,
}

function createOfficialPagePortMetadataProxy(target, {
  widgetRef,
  interactionModel,
  recognizedKinds = [],
} = {}) {
  if (!target || typeof target !== 'object') return target
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'describeWorkspace') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return async (...args) => {
          const description = await original.apply(obj, args)
          return appendOfficialPageMultiViewActionsToWorkspaceDescription(description, {
            widgetRef,
            interactionModel,
            recognizedKinds,
          })
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

function createOfficialPageWorkspaceContractProxy(target, {
  widgetRef,
  interactionModel,
  recognizedKinds = [],
  executeParamAction,
  executeVerifiedParamAction,
  syncAfterAction,
} = {}) {
  if (!target || typeof target !== 'object') return target

  const filterWorkspaceDescription = (description) => appendOfficialPageMultiViewActionsToWorkspaceDescription(description, {
    widgetRef,
    interactionModel,
    recognizedKinds,
  })
  const readExecutableActionNames = () => new Set(buildOfficialPageExecutableActionNames({
    interactionModel,
    recognizedKinds,
  }))

  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'describe' || prop === 'describeWorkspace') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => filterWorkspaceDescription(original.apply(obj, args))
      }
      if (prop === 'readObservation') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => original.apply(receiver, args)
      }
      if (prop === 'executeAction' || prop === 'executeVerifiedAction') {
        const original = Reflect.get(obj, prop, receiver)
        const executeOfficialAction = prop === 'executeVerifiedAction'
          ? executeVerifiedParamAction
          : executeParamAction
        return async (call = {}, options = {}) => {
          const actionName = typeof call?.name === 'string' ? call.name : null
          if (actionName && readExecutableActionNames().has(actionName) && typeof executeOfficialAction === 'function') {
            const result = await executeOfficialAction(call, options)
            if (result?.ok && typeof syncAfterAction === 'function') {
              await syncAfterAction()
            }
            if (result) return result
          }
          if (typeof original !== 'function') {
            throw new Error(`WidgetVA official page workspace does not expose ${String(prop)}().`)
          }
          return original.call(obj, call, options)
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

function readRecoverableSelectionRegistry(state = null) {
  const candidates = [
    state?.shared?.activeSelections,
    state?.shared?.selections,
    state?.selections,
    state?.sharedAnalyticalState?.selections,
    state?.sharedAnalyticalState?.activeSelections,
  ]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return clone(candidate)
    }
  }
  return null
}

function createOfficialPageAgentLoopRunner(agentTarget) {
  return async function runOfficialPageAgentLoop(options = {}) {
    if (!agentTarget || typeof agentTarget.describeWorkspace !== 'function') {
      throw new Error('WidgetVA page port is not ready for captured Vega-Lite page agent-loop execution.')
    }
    return runAgentLoopOnTarget(agentTarget, options)
  }
}

export function isOfficialVegaLiteGalleryPage(pageUrl) {
  const parsedUrl = tryParseUrl(pageUrl)
  if (!parsedUrl) return false
  return (
    parsedUrl.hostname === 'vega.github.io'
    && parsedUrl.pathname.startsWith('/vega-lite/examples/')
    && parsedUrl.pathname.endsWith('.html')
  )
}

function collectNestedVegaLiteSpecs(spec) {
  const nested = []
  const childArrays = [
    spec?.layer,
    spec?.vconcat,
    spec?.hconcat,
    spec?.concat,
  ]

  for (const entries of childArrays) {
    if (Array.isArray(entries)) {
      nested.push(...entries.filter((entry) => entry && typeof entry === 'object'))
    }
  }

  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    nested.push(spec.spec)
  }

  return nested
}

function inferExplicitWidgetKindHint(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return null
  }

  const explicitKind = normalizeExplicitWidgetKindHint(spec?.widgetKind)
    || normalizeExplicitWidgetKindHint(spec?.kind)
    || normalizeExplicitWidgetKindHint(spec?.usermeta?.widgetva?.widgetKind)
    || normalizeExplicitWidgetKindHint(spec?.usermeta?.widgetva?.kind)
    || inferExplicitWidgetKindHintFromTitle(spec?.title)
  if (explicitKind) return explicitKind
  return null
}

function normalizeExplicitWidgetKindHint(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  if (normalized === 'parallelCoordinates') return 'parallelCoordinates'
  const lower = normalized.toLowerCase()
  if (lower === 'parallelcoordinates' || lower === 'parallel-coordinates' || lower === 'parallel_coordinates') return 'parallelCoordinates'
  if (lower === 'sankey') return 'sankey'
  if (lower === 'map') return 'map'
  return null
}

function readVegaLiteTitleText(title) {
  if (typeof title === 'string') return title
  if (title && typeof title === 'object' && !Array.isArray(title) && typeof title.text === 'string') return title.text
  return ''
}

function inferExplicitWidgetKindHintFromTitle(title) {
  const normalizedTitle = readVegaLiteTitleText(title).toLowerCase()
  if (!normalizedTitle) return null
  if (normalizedTitle.includes('parallel coordinates') || normalizedTitle.includes('parallel coordinate') || normalizedTitle.includes('平行坐标')) {
    return 'parallelCoordinates'
  }
  if (normalizedTitle.includes('sankey') || normalizedTitle.includes('桑基')) {
    return 'sankey'
  }
  return null
}

function inferSemanticWidgetKindFromVegaLiteSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return null
  }

  const explicitKind = inferExplicitWidgetKindHint(spec)
  if (explicitKind) return explicitKind

  const directKind = inferWidgetKindFromMark(spec?.mark)
  if (directKind) return directKind

  const layeredEntries = Array.isArray(spec?.layer) ? spec.layer : []
  for (const entry of layeredEntries) {
    const layeredKind = inferSemanticWidgetKindFromVegaLiteSpec(entry)
    if (layeredKind) return layeredKind
  }

  const compositeKeys = ['vconcat', 'hconcat', 'concat']
  for (const key of compositeKeys) {
    const entries = Array.isArray(spec?.[key]) ? spec[key] : []
    for (const entry of entries) {
      const nestedKind = inferSemanticWidgetKindFromVegaLiteSpec(entry)
      if (nestedKind) return nestedKind
    }
  }

  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    return inferSemanticWidgetKindFromVegaLiteSpec(spec.spec)
  }

  return null
}

function collectRecognizedWidgetKindsFromSemanticViews(spec, target = []) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return target
  }

  const concatKeys = ['vconcat', 'hconcat', 'concat']
  for (const key of concatKeys) {
    const entries = Array.isArray(spec?.[key]) ? spec[key] : null
    if (!entries) continue
    for (const entry of entries) {
      collectRecognizedWidgetKindsFromSemanticViews(entry, target)
    }
    return target
  }

  if (isRecord(spec?.repeat) && isRecord(spec?.spec)) {
    collectRecognizedWidgetKindsFromSemanticViews(spec.spec, target)
    return target
  }

  if (isRecord(spec?.facet) && isRecord(spec?.spec)) {
    collectRecognizedWidgetKindsFromSemanticViews(spec.spec, target)
    return target
  }

  const semanticKind = inferSemanticWidgetKindFromVegaLiteSpec(spec)
  if (semanticKind) {
    pushUniqueKind(target, semanticKind)
  }
  return target
}

function inferRecognizedWidgetKindsFromParamProducers(interactionModel = null) {
  const interactionModes = Array.isArray(interactionModel?.widgetSemantics?.classification?.interactionModes)
    ? interactionModel.widgetSemantics.classification.interactionModes
    : []
  const compositeKinds = Array.isArray(interactionModel?.compositeKinds) ? interactionModel.compositeKinds : []
  const hasStructuredMultiView = compositeKinds.some((kind) => ['vconcat', 'hconcat', 'concat', 'repeat', 'facet'].includes(kind))
  const pointParams = Array.isArray(interactionModel?.params)
    ? interactionModel.params.filter((entry) => entry?.selectionType === 'point')
    : []
  const isLayeredPointFocusDetail = compositeKinds.includes('layer')
    && !hasStructuredMultiView
    && pointParams.length > 0
    && pointParams.every((entry) => {
      const producerKind = inferWidgetKindFromMark(entry?.producerMark)
      return producerKind === 'scatter'
        && Array.isArray(entry?.consumerTypes)
        && entry.consumerTypes.length > 0
        && entry.consumerTypes.every((consumerType) => consumerType === 'condition' || consumerType === 'conditionTest')
    })
  const shouldPreferProducerKinds = isLayeredPointFocusDetail
    || (interactionModes.includes('focusDetail') && !hasStructuredMultiView)
    || (interactionModes.includes('boundParameter') && !hasStructuredMultiView)
  if (!shouldPreferProducerKinds) {
    return []
  }

  const producerKinds = Array.isArray(interactionModel?.params)
    ? interactionModel.params
      .map((entry) => inferWidgetKindFromMark(entry?.producerMark))
      .filter(Boolean)
    : []
  return uniqueKinds(producerKinds)
}

function inferRecognizedWidgetKindsFromInteractionModel(spec, interactionModel = null) {
  const interactionModes = Array.isArray(interactionModel?.widgetSemantics?.classification?.interactionModes)
    ? interactionModel.widgetSemantics.classification.interactionModes
    : []
  const compositeKinds = Array.isArray(interactionModel?.compositeKinds) ? interactionModel.compositeKinds : []
  const hasStructuredMultiView = compositeKinds.some((kind) => ['vconcat', 'hconcat', 'concat', 'repeat', 'facet'].includes(kind))
  const pointParams = Array.isArray(interactionModel?.params)
    ? interactionModel.params.filter((entry) => entry?.selectionType === 'point')
    : []
  const semanticKinds = collectRecognizedWidgetKindsFromSemanticViews(spec, [])
  const isLayeredLineHoverProxy = (
    interactionModes.includes('focusDetail')
    && compositeKinds.includes('layer')
    && !hasStructuredMultiView
    && semanticKinds.includes('line')
    && pointParams.length > 0
    && pointParams.every((entry) => {
      const producerKind = inferWidgetKindFromMark(entry?.producerMark)
      const producerSpec = resolveSpecNodeByViewId(spec, entry?.producerViewId)
      const usesEncodingProxy = Array.isArray(entry?.encodings)
        && entry.encodings.length > 0
        && (!Array.isArray(entry?.fields) || entry.fields.length === 0)
      const usesInheritedPointProxy = (
        producerSpec
        && producerKind === 'scatter'
        && (
          !producerSpec?.encoding
          || (
            typeof producerSpec?.encoding?.x?.field !== 'string'
            && typeof producerSpec?.encoding?.y?.field !== 'string'
          )
        )
      )
      return producerKind === 'scatter'
        && (usesEncodingProxy || usesInheritedPointProxy)
    })
  )
  if (isLayeredLineHoverProxy) {
    return ['line']
  }

  const producerKinds = inferRecognizedWidgetKindsFromParamProducers(interactionModel)
  if (producerKinds.length > 0) {
    return producerKinds
  }
  if (semanticKinds.length > 0) {
    return uniqueKinds(semanticKinds)
  }
  const interactionKinds = Array.isArray(interactionModel?.views)
    ? interactionModel.views
      .map((view) => inferSemanticWidgetKindFromVegaLiteSpec(view?.spec))
      .filter(Boolean)
    : []
  if (interactionKinds.length > 0) {
    return uniqueKinds(interactionKinds)
  }
  return uniqueKinds(inferWidgetKindsFromVegaLiteSpec(spec))
}

export function inferWidgetKindsFromVegaLiteSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return []
  }

  const inferredKinds = []

  const explicitKind = inferExplicitWidgetKindHint(spec)
  if (explicitKind) return [explicitKind]

  pushUniqueKind(inferredKinds, inferWidgetKindFromMark(spec?.mark))

  for (const child of collectNestedVegaLiteSpecs(spec)) {
    for (const kind of inferWidgetKindsFromVegaLiteSpec(child)) {
      pushUniqueKind(inferredKinds, kind)
    }
  }

  return inferredKinds
}

export function inferWidgetKindFromVegaLiteSpec(spec) {
  const candidateKinds = inferWidgetKindsFromVegaLiteSpec(spec)
  if (candidateKinds.length === 1) {
    return candidateKinds[0]
  }
  return 'custom'
}

export function readGenericVegaLiteIntegrationInput({
  spec,
  pageUrl = '',
} = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('readGenericVegaLiteIntegrationInput requires a Vega-Lite spec object.')
  }

  const normalizedSpec = normalizeOfficialVegaLitePageSpec(spec, pageUrl)
  const candidateKinds = inferWidgetKindsFromVegaLiteSpec(normalizedSpec)
  const interactionModel = describeVegaLiteMultiViewInteractions(normalizedSpec)
  const recognizedKinds = inferRecognizedWidgetKindsFromInteractionModel(normalizedSpec, interactionModel)
  return {
    provider: 'vega-lite',
    kind: recognizedKinds.length === 1 ? recognizedKinds[0] : 'custom',
    candidateKinds,
    recognizedKinds,
    interactionModel,
    spec: normalizedSpec,
    pageUrl: typeof pageUrl === 'string' ? pageUrl : '',
  }
}

export function readOfficialVegaLitePageIntegrationInput({
  html = '',
  text = '',
  pageUrl = '',
} = {}) {
  if (!isOfficialVegaLiteGalleryPage(pageUrl)) {
    throw new Error(`Unsupported Vega-Lite examples URL: ${pageUrl}`)
  }

  const parsedSpec = extractOfficialVegaLitePageSpecFromHtml(html) || extractOfficialVegaLitePageSpecFromText(text)
  if (!parsedSpec) {
    throw new Error('Unable to extract a Vega-Lite example spec from the provided page content.')
  }

  const spec = normalizeOfficialVegaLitePageSpec(parsedSpec, pageUrl)
  return readGenericVegaLiteIntegrationInput({ spec, pageUrl })
}

async function createAttachedVegaLiteController({
  root = globalThis.window,
  integrationInput,
  view = null,
  capture = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current Vega-Lite view through WidgetVA structured actions.',
} = {}) {
  if (!view) {
    throw new Error('createAttachedVegaLiteController requires a Vega/Vega-Lite view instance.')
  }

  const hydratedSpec = await loadOfficialPageDataValues({
    root,
    spec: integrationInput.spec,
  })
  const hydratedAugmentedSpec = addHeatmapAxisAliasesToRows(hydratedSpec)
  if (Array.isArray(integrationInput.candidateKinds) && integrationInput.candidateKinds.length > 0) {
    hydratedAugmentedSpec.__widgetvaCandidateKinds = [...integrationInput.candidateKinds]
  }
  if (Array.isArray(integrationInput.recognizedKinds) && integrationInput.recognizedKinds.length > 0) {
    hydratedAugmentedSpec.__widgetvaRecognizedKinds = [...integrationInput.recognizedKinds]
  }
  const normalizedInput = {
    ...integrationInput,
    spec: hydratedAugmentedSpec,
  }
  const widgetAdapter = createVegaLiteWidgetAdapter({ kind: normalizedInput.kind })
  const baselineSpec = clone(normalizedInput.spec)
  const currentSpecRef = { current: clone(normalizedInput.spec) }
  const renderedSpecRef = { current: clone(normalizedInput.spec) }
  const viewRef = { current: view }
  const originalPagePort = root?.__widgetVA || null
  const hostBridge = createOfficialPageHostBridge({
    sessionId: sessionId || `vega-lite-${normalizedInput.kind}`,
    baselineSpec,
    currentSpecRef,
    userIntent,
    emitOnWrite: true,
  })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec: baselineSpec,
    runtimeOptions: {
      hostBridge,
    },
  })

  await widget.mount({
    view,
    spec: baselineSpec,
    bindHumanInteractions: false,
  })

  const rematerialize = createOfficialPageMaterializer({
    root,
    capture,
    currentSpecRef,
    renderedSpecRef,
    viewRef,
  })
  const readOfficialPageSelectionStateForWidget = () => readOfficialPageSelectionState({
    widgetState: clone(widget.readState?.() || {}) || {},
    workspaceState: clone(widget.readWorkspaceState?.() || {}) || {},
    hostSelections: clone(hostBridge.readCurrentSelections?.() || {}) || {},
  })
  const sourceWidgetId = widget.resolveWidgetId() || widget.resolveWidgetRef() || sessionId || `vega-lite-${normalizedInput.kind}`
  const sourceWidgetRef = widget.resolveWidgetRef() || null

  let pendingSharedStateMaterialization = Promise.resolve()
  const materializeFromSharedState = async () => {
    const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
      semanticSpec: currentSpecRef.current,
      state: readOfficialPageSelectionStateForWidget(),
      runtime: widget.runtime,
    })
    const renderMatchesCurrent = JSON.stringify(renderedSpecRef.current) === JSON.stringify(renderSpec)
    if (renderMatchesCurrent) return
    await rematerialize(renderSpec)
  }
  const unsubscribeSharedStateMaterialization = hostBridge.subscribe(() => {
    pendingSharedStateMaterialization = pendingSharedStateMaterialization
      .catch(() => {})
      .then(() => materializeFromSharedState())
      .catch(() => {})
  })

  const syncOfficialPageAfterAction = async () => {
    await Promise.resolve()
    await Promise.resolve(pendingSharedStateMaterialization).catch(() => {})
  }

  const {
    executeParamAction,
    executeVerifiedParamAction,
  } = createOfficialPageParamActionDispatcher({
    widget,
    spec: () => currentSpecRef.current,
    interactionModel: normalizedInput.interactionModel,
    sourceWidgetId,
    sourceWidgetRef,
    hostBridge,
  })

  const proxiedWidget = createOfficialPageActionDispatchProxy(widget, {
    executeParamAction,
    executeVerifiedParamAction,
    syncAfterAction: syncOfficialPageAfterAction,
  })
  const mountedPagePort = root?.__widgetVA || null
  const proxiedPagePort = createOfficialPageActionDispatchProxy(mountedPagePort, {
    executeParamAction,
    executeVerifiedParamAction,
    syncAfterAction: syncOfficialPageAfterAction,
  })
  const metadataAwarePagePort = createOfficialPagePortMetadataProxy(proxiedPagePort, {
    widgetRef: widget.resolveWidgetRef(),
    interactionModel: normalizedInput.interactionModel,
    recognizedKinds: normalizedInput.recognizedKinds || normalizedInput.candidateKinds,
  })
  if (mountedPagePort && metadataAwarePagePort && root) {
    root.__widgetVA = metadataAwarePagePort
  }
  const baseWorkspace = createWidgetWorkspace({
    runtime: widget.runtime,
    widgets: [proxiedWidget],
  })
  const workspace = createOfficialPageWorkspaceContractProxy(baseWorkspace, {
    widgetRef: widget.resolveWidgetRef(),
    interactionModel: normalizedInput.interactionModel,
    recognizedKinds: normalizedInput.recognizedKinds || normalizedInput.candidateKinds,
    executeParamAction,
    executeVerifiedParamAction,
    syncAfterAction: syncOfficialPageAfterAction,
  })

  return {
    ...normalizedInput,
    widget: proxiedWidget,
    workspace,
    widgetAdapter,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(workspace),
    readRecoverableState() {
      return readControllerRecoverableState(widget)
    },
    async restoreRecoverableState(state) {
      const recoverableSelections = readRecoverableSelectionRegistry(state)
      if (recoverableSelections && typeof hostBridge?.writeCurrentSelections === 'function') {
        hostBridge.writeCurrentSelections(recoverableSelections, {
          primarySelectionRef: Object.keys(recoverableSelections)[0] || null,
        })
        await syncOfficialPageAfterAction()
        return {
          ok: true,
          stateId: state?.stateId || null,
          method: 'sharedSelections',
        }
      }
      return restoreControllerRecoverableState(widget, state, 'Vega-Lite page controller')
    },
    getCurrentSpec() {
      return clone(currentSpecRef.current)
    },
    getRenderedSpec() {
      return clone(renderedSpecRef.current)
    },
    dispose() {
      unsubscribeSharedStateMaterialization?.()
      if (root?.__widgetVA === metadataAwarePagePort || root?.__widgetVA === proxiedPagePort) {
        if (originalPagePort) root.__widgetVA = originalPagePort
        else delete root.__widgetVA
      }
      baseWorkspace.dispose()
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToVegaLiteView({
  root = globalThis.window,
  spec = null,
  pageUrl = '',
  view = null,
  capture = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current Vega-Lite view through WidgetVA structured actions.',
} = {}) {
  const integrationInput = readGenericVegaLiteIntegrationInput({ spec, pageUrl })
  return createAttachedVegaLiteController({
    root,
    integrationInput,
    view,
    capture,
    sessionId,
    userIntent,
  })
}

export async function attachWidgetVAToOfficialVegaLitePage({
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
    throw new Error('attachWidgetVAToOfficialVegaLitePage requires a Vega/Vega-Lite view instance.')
  }

  const integrationInput = readOfficialVegaLitePageIntegrationInput({ html, text, pageUrl })
  return createAttachedVegaLiteController({
    root,
    integrationInput,
    view,
    capture,
    sessionId: sessionId || `official-vega-lite-${integrationInput.kind}`,
    userIntent,
  })
}

export async function attachWidgetVAToCapturedVegaLiteView({
  root = globalThis.window,
  spec = null,
  pageUrl = '',
  sessionId = null,
  userIntent,
} = {}) {
  const latestCapture = readLatestVegaEmbedCapture(root)
  const view = latestCapture?.view || latestCapture?.result?.view || null
  if (!view) {
    throw new Error('No captured Vega embed view is available on the current page.')
  }

  const effectiveSpec = spec || latestCapture?.spec || null
  if (!effectiveSpec) {
    throw new Error('attachWidgetVAToCapturedVegaLiteView requires a Vega-Lite spec or a captured vegaEmbed spec.')
  }

  return attachWidgetVAToVegaLiteView({
    root,
    spec: effectiveSpec,
    pageUrl: pageUrl || root?.location?.href || '',
    view,
    capture: latestCapture,
    sessionId,
    userIntent,
  })
}

export async function attachWidgetVAToCapturedOfficialVegaLitePage({
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

  if (!isOfficialVegaLiteGalleryPage(fallbackPageUrl)) {
    const fallbackSpec = latestCapture?.spec
      || extractOfficialVegaLitePageSpecFromHtml(fallbackHtml)
      || extractOfficialVegaLitePageSpecFromText(fallbackText)
      || null
    if (!fallbackSpec) {
      throw new Error('attachWidgetVAToCapturedOfficialVegaLitePage could not resolve a Vega-Lite spec for a non-official captured page.')
    }
    return attachWidgetVAToVegaLiteView({
      root,
      spec: fallbackSpec,
      pageUrl: fallbackPageUrl,
      view,
      capture: latestCapture,
      sessionId,
      userIntent,
    })
  }

  return attachWidgetVAToOfficialVegaLitePage({
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

export async function waitForCapturedVegaLiteView({
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

export async function attachWidgetVAToCurrentCapturedVegaLitePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  forceReattach = false,
} = {}) {
  installVegaEmbedCapture(root)
  if (forceReattach) {
    clearLatestVegaEmbedCapture(root)
  }
  await waitForCapturedVegaLiteView({
    root,
    timeoutMs,
    pollMs,
  })

  return attachWidgetVAToCapturedOfficialVegaLitePage({
    root,
    html,
    text,
    pageUrl,
    sessionId,
    userIntent,
  })
}

export async function bootstrapCurrentCapturedVegaLitePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  enableExtensionBridge = true,
  forceReattach = false,
} = {}) {
  const controller = await attachWidgetVAToCurrentCapturedVegaLitePage({
    root,
    html,
    text,
    pageUrl,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
    forceReattach,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(controller.workspace),
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}

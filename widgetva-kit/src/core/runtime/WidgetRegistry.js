import { parseRef } from '../protocol/refs.js'
import { makeWidgetDescription } from '../protocol/description.js'
import { makeWidgetState } from '../protocol/state.js'
import { normalizeWidgetLink } from '../protocol/widgetLinks.js'
import {
  makeWidgetRegistryCounts,
  makeWidgetRegistryRefs,
  makeWidgetRegistrySummary,
} from '../protocol/widgetRegistry.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function summarizeWidgetEntry(widgetDescription, widgetState, widgetAdapter) {
  const humanInteraction = {
    ...(widgetAdapter?.getHumanInteractionConfig?.() || {}),
    ...(widgetState?.humanInteraction || {}),
    ...(widgetDescription?.humanInteraction || {}),
  }
  return {
    ref: widgetDescription?.ref || '',
    widgetId: widgetDescription?.widgetId || '',
    kind: widgetDescription?.kind || '',
    role: widgetDescription?.role || '',
    title: widgetDescription?.title || '',
    description: widgetDescription?.description || '',
    analyticRoles: Array.isArray(widgetDescription?.analyticRoles) ? [...widgetDescription.analyticRoles] : [],
    sourceKind: widgetDescription?.sourceKind || null,
    supportsSpecMutation: widgetDescription?.supportsSpecMutation === true,
    primaryDataRef: widgetDescription?.primaryDataRef || widgetState?.data?.sourceDataRef || null,
    sourceDataRef: widgetState?.data?.sourceDataRef || null,
    currentDataRef: widgetState?.data?.currentDataRef || null,
    usageNotes: Array.isArray(widgetDescription?.usageNotes) ? [...widgetDescription.usageNotes] : [],
    actionNames: Array.isArray(widgetDescription?.actionNames) ? [...widgetDescription.actionNames] : [],
    perceptionQueryNames: Array.isArray(widgetDescription?.perceptionQueryNames)
      ? [...widgetDescription.perceptionQueryNames]
      : [],
    adapterProvider: widgetAdapter?.provider || null,
    providerCapabilities: widgetAdapter?.providerCapabilities ? clone(widgetAdapter.providerCapabilities) : null,
    adapterCapabilities: widgetAdapter
      ? {
          canDescribe: typeof widgetAdapter.getDescription === 'function',
          canReadState: typeof widgetAdapter.getState === 'function',
          canApplyState: typeof widgetAdapter.applyState === 'function',
          canBindHumanInteractions: typeof widgetAdapter.bindHumanInteractions === 'function',
          canRegisterActions: typeof widgetAdapter.registerActions === 'function',
          canRegisterPerceptionQueries: typeof widgetAdapter.registerPerceptionQueries === 'function',
        }
      : null,
    humanInteractionMode: humanInteraction.mode || null,
    humanInteractionActionName: humanInteraction.actionName || null,
    supportsDirectManipulation: humanInteraction?.supportsDirectManipulation === true,
  }
}

function buildResolvedWidget(widgetDescription, widgetState, widgetAdapter) {
  if (!widgetDescription && !widgetState) return null
  return {
    ...(widgetDescription || {}),
    ...(widgetState || {}),
    ref: widgetDescription?.ref || widgetState?.ref || '',
    kind: widgetDescription?.kind || widgetState?.kind || '',
    title: widgetDescription?.title || '',
    description: widgetDescription?.description || '',
    primaryDataRef: widgetDescription?.primaryDataRef || widgetState?.data?.sourceDataRef || null,
    widgetId: widgetDescription?.widgetId || widgetState?.widgetId || '',
    role: widgetDescription?.role || widgetState?.role || '',
    actionNames: Array.isArray(widgetDescription?.actionNames) ? widgetDescription.actionNames : [],
    perceptionQueryNames: Array.isArray(widgetDescription?.perceptionQueryNames) ? widgetDescription.perceptionQueryNames : [],
    usageNotes: Array.isArray(widgetDescription?.usageNotes) ? widgetDescription.usageNotes : [],
    adapterProvider: widgetAdapter?.provider || null,
    providerCapabilities: widgetAdapter?.providerCapabilities || null,
    humanInteraction: widgetDescription?.humanInteraction || widgetState?.humanInteraction || null,
  }
}

function widgetUsesDataRef(widgetDescription, widgetState, dataRef) {
  if (!dataRef) return false
  return widgetDescription?.primaryDataRef === dataRef
    || widgetState?.data?.currentDataRef === dataRef
    || widgetState?.data?.sourceDataRef === dataRef
}

export class WidgetRegistry {
  constructor() {
    this.widgetDescriptions = {}
    this.widgetStates = {}
    this.dataHandles = {}
    this.links = {}
    this.widgetAdapters = {}
    this.widgetEntries = []
  }

  rebuildWidgetEntries() {
    this.widgetEntries = Object.values(this.widgetDescriptions).map((widgetDescription) =>
      summarizeWidgetEntry(
        widgetDescription,
        this.widgetStates?.[widgetDescription.ref] || null,
        this.widgetAdapters?.[widgetDescription.ref] || null,
      ),
    )
  }

  setState(state) {
    this.widgetStates = Object.fromEntries(
      Object.entries(state?.widgets || {}).map(([ref, widgetState]) => {
        const normalizedState = makeWidgetState({
          ref,
          ...widgetState,
        })
        return [ref, normalizedState]
      }),
    )
    this.rebuildWidgetEntries()
  }

  updateDataHandle(ref, handle) {
    if (!ref || !handle) return
    this.dataHandles = {
      ...(this.dataHandles || {}),
      [ref]: handle,
    }
  }

  removeDataHandle(ref) {
    if (!ref || !this.dataHandles?.[ref]) return
    const nextHandles = { ...(this.dataHandles || {}) }
    delete nextHandles[ref]
    this.dataHandles = nextHandles
  }

  replaceWorkspace({ description, state, widgetAdapters } = {}) {
    this.widgetDescriptions = Object.fromEntries(
      (description?.widgets || []).map((item) => {
        const normalizedDescription = makeWidgetDescription(item)
        return [normalizedDescription.ref, normalizedDescription]
      }),
    )
    this.dataHandles = Object.fromEntries(
      (description?.dataHandles || []).map((item) => [item.ref, item]),
    )
    this.links = Object.fromEntries(
      (description?.links || []).map((item) => {
        const normalizedLink = normalizeWidgetLink(item)
        return [normalizedLink.ref, normalizedLink]
      }),
    )
    this.widgetAdapters = Object.fromEntries(
      (Array.isArray(widgetAdapters) ? widgetAdapters : []).map((adapter) => [adapter.widgetRef, adapter]),
    )
    this.setState(state)
  }

  listWidgetRefs() {
    return Object.keys(this.widgetDescriptions)
  }

  listDataRefs() {
    return Object.keys(this.dataHandles)
  }

  listLinkRefs() {
    return Object.keys(this.links)
  }

  getWidget(ref) {
    return ref ? this.widgetDescriptions?.[ref] || null : null
  }

  getWidgetState(ref) {
    return ref ? this.widgetStates?.[ref] || null : null
  }

  getWidgetEntry(ref) {
    if (!ref) return null
    const description = this.getWidget(ref)
    if (!description) return null
    return summarizeWidgetEntry(
      description,
      this.getWidgetState(ref),
      this.getWidgetAdapter(ref),
    )
  }

  getResolvedWidget(ref) {
    if (!ref) return null
    return buildResolvedWidget(
      this.getWidget(ref),
      this.getWidgetState(ref),
      this.getWidgetAdapter(ref),
    )
  }

  findWidgetRefForDataRef(dataRef) {
    if (!dataRef) return null
    const widgetRefs = this.listWidgetRefs()
    for (const widgetRef of widgetRefs) {
      if (widgetUsesDataRef(this.getWidget(widgetRef), this.getWidgetState(widgetRef), dataRef)) {
        return widgetRef
      }
    }
    return null
  }

  findWidgetRefForSelectionRef(selectionRef) {
    if (!selectionRef) return null
    const selectionParts = parseRef(selectionRef)
    if (!selectionParts || selectionParts.kind !== 'selection' || !selectionParts.widgetId) {
      return null
    }

    const widgetRefs = this.listWidgetRefs()
    for (const widgetRef of widgetRefs) {
      const widgetDescription = this.getWidget(widgetRef)
      const widgetState = this.getWidgetState(widgetRef)
      if (widgetDescription?.widgetId === selectionParts.widgetId || widgetState?.widgetId === selectionParts.widgetId) {
        return widgetRef
      }
    }
    return null
  }

  getResolvedWidgetForTarget(ref) {
    if (!ref) return null
    const directWidget = this.getResolvedWidget(ref)
    if (directWidget) return directWidget
    const selectionWidgetRef = this.findWidgetRefForSelectionRef(ref)
    if (selectionWidgetRef) return this.getResolvedWidget(selectionWidgetRef)
    const widgetRef = this.findWidgetRefForDataRef(ref)
    return widgetRef ? this.getResolvedWidget(widgetRef) : null
  }

  getDataHandle(ref) {
    return ref ? this.dataHandles?.[ref] || null : null
  }

  getLink(ref) {
    return ref ? this.links?.[ref] || null : null
  }

  getWidgetAdapter(ref) {
    return ref ? this.widgetAdapters?.[ref] || null : null
  }

  describe() {
    return clone(makeWidgetRegistrySummary({
      counts: makeWidgetRegistryCounts({
        widgetCount: this.listWidgetRefs().length,
        dataHandleCount: this.listDataRefs().length,
        linkCount: this.listLinkRefs().length,
        adapterCount: Object.keys(this.widgetAdapters).length,
      }),
      refs: makeWidgetRegistryRefs({
        widgetRefs: this.listWidgetRefs(),
        dataRefs: this.listDataRefs(),
        linkRefs: this.listLinkRefs(),
      }),
      widgets: this.widgetEntries,
      dataHandles: Object.values(this.dataHandles || {}),
      links: Object.values(this.links || {}),
    }))
  }
}

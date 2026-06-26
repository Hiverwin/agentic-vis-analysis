function defaultHumanInteraction() {
  return {
    mode: 'none',
    actionName: null,
    supportsDirectManipulation: false,
  }
}

function assertFunction(name, value) {
  if (value == null) return
  if (typeof value !== 'function') {
    throw new Error(`Widget adapter contract field ${name} must be a function when provided.`)
  }
}

function assertRequiredFunction(name, value) {
  if (typeof value !== 'function') {
    throw new Error(`Widget adapter instance requires ${name}() to be provided.`)
  }
}

function assertObject(name, value) {
  if (value == null) return
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Widget adapter contract field ${name} must be an object when provided.`)
  }
}

function defaultProviderCapabilities() {
  return {
    supportedWidgetKinds: [],
    renderStrategy: 'custom',
    stateApplyStrategy: 'custom',
    interactionBindingStrategy: 'custom',
    supportsRendererMount: false,
    supportsRendererUpdate: false,
    supportsRendererDispose: false,
    supportsSignalPatching: false,
    supportsOptionMerging: false,
    supportsImperativeRender: false,
    supportsPointSelection: false,
    supportsIntervalSelection: false,
    supportsZoomPan: false,
    supportsFocusReadback: false,
    supportsSelectionReadback: false,
    supportsViewportReadback: false,
    supportsHighlightProjection: false,
    supportsInteractionEvents: false,
  }
}

function looksLikeWidgetState(value) {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      typeof value.widgetId === 'string'
      || typeof value.ref === 'string'
      || typeof value.kind === 'string'
      || value.view != null
      || value.selections != null
      || value.data != null
      || value.feedback != null
    )
}

function normalizeApplyStateArgs(args) {
  if (args != null && typeof args === 'object' && !Array.isArray(args) && Object.prototype.hasOwnProperty.call(args, 'state')) {
    return args
  }
  if (looksLikeWidgetState(args)) {
    return { state: args }
  }
  return args
}

export function createWidgetAdapterInstance({
  definition,
  widgetRef,
  dataRef,
  getDescription,
  getState,
  humanInteraction,
  bindHumanInteractions,
  applyState,
  mount,
  update,
  dispose,
  readSelection,
  readViewport,
  metadata,
}) {
  assertRequiredFunction('getDescription', getDescription)
  assertRequiredFunction('getState', getState)
  const resolvedHumanInteraction = humanInteraction || definition.getHumanInteractionConfig?.() || defaultHumanInteraction()
  const resolvedBindHumanInteractions = bindHumanInteractions || definition.bindHumanInteractions || (() => {})
  const resolvedApplyState = applyState || definition.applyState || (() => {})
  const resolvedMount = mount || definition.mount || (() => null)
  const resolvedUpdate = update || definition.update || (() => null)
  const resolvedDispose = dispose || definition.dispose || (() => {})
  const resolvedReadSelection = readSelection || definition.readSelection || (() => null)
  const resolvedReadViewport = readViewport || definition.readViewport || (() => null)
  return {
    kind: definition.kind,
    provider: definition.provider || 'custom',
    providerCapabilities: {
      ...defaultProviderCapabilities(),
      ...(definition.providerCapabilities || {}),
    },
    widgetRef,
    dataRef,
    metadata: metadata || {},
    getDescription,
    getState,
    buildActionDescriptors(args) {
      return definition.buildActionDescriptors?.(args) || []
    },
    buildPerceptionDescriptors(args) {
      return definition.buildPerceptionDescriptors?.(args) || []
    },
    registerActions(router) {
      definition.registerActions?.(router)
    },
    registerPerceptionQueries(registry) {
      definition.registerPerceptionQueries?.(registry)
    },
    bindHumanInteractions: resolvedBindHumanInteractions,
    applyState(args) {
      return resolvedApplyState(normalizeApplyStateArgs(args))
    },
    mount(args = {}) {
      return resolvedMount(args)
    },
    update(args = {}) {
      return resolvedUpdate(args)
    },
    dispose(args = {}) {
      return resolvedDispose(args)
    },
    readSelection(args = {}) {
      return resolvedReadSelection(args)
    },
    readViewport(args = {}) {
      return resolvedReadViewport(args)
    },
    describeCapabilities() {
      return {
        provider: definition.provider || 'custom',
        providerCapabilities: {
          ...defaultProviderCapabilities(),
          ...(definition.providerCapabilities || {}),
        },
      }
    },
    getHumanInteractionConfig() {
      return resolvedHumanInteraction
    },
  }
}

export function createWidgetAdapterDefinition(definition) {
  if (!definition?.kind || typeof definition.kind !== 'string') {
    throw new Error('Widget adapter definition requires a string kind.')
  }
  assertFunction('buildActionDescriptors', definition?.buildActionDescriptors)
  assertFunction('buildPerceptionDescriptors', definition?.buildPerceptionDescriptors)
  assertFunction('getHumanInteractionConfig', definition?.getHumanInteractionConfig)
  assertFunction('registerActions', definition?.registerActions)
  assertFunction('registerPerceptionQueries', definition?.registerPerceptionQueries)
  assertFunction('bindHumanInteractions', definition?.bindHumanInteractions)
  assertFunction('applyState', definition?.applyState)
  assertFunction('mount', definition?.mount)
  assertFunction('update', definition?.update)
  assertFunction('dispose', definition?.dispose)
  assertFunction('readSelection', definition?.readSelection)
  assertFunction('readViewport', definition?.readViewport)
  assertObject('providerCapabilities', definition?.providerCapabilities)

  return {
    provider: 'custom',
    providerCapabilities: defaultProviderCapabilities(),
    buildActionDescriptors: () => [],
    buildPerceptionDescriptors: () => [],
    getHumanInteractionConfig: defaultHumanInteraction,
    registerActions: () => {},
    registerPerceptionQueries: () => {},
    bindHumanInteractions: () => () => {},
    applyState: () => {},
    mount: () => null,
    update: () => null,
    dispose: () => {},
    readSelection: () => null,
    readViewport: () => null,
    createInstance(args) {
      return createWidgetAdapterInstance({
        definition,
        humanInteraction: definition.getHumanInteractionConfig?.(),
        bindHumanInteractions: definition.bindHumanInteractions,
        applyState: definition.applyState,
        mount: definition.mount,
        update: definition.update,
        dispose: definition.dispose,
        readSelection: definition.readSelection,
        readViewport: definition.readViewport,
        ...args,
      })
    },
    ...definition,
  }
}

export function createWidgetAdapterContract(definition) {
  return createWidgetAdapterDefinition(definition)
}

export function instantiateWidgetAdapter(options) {
  return createWidgetAdapterInstance(options)
}

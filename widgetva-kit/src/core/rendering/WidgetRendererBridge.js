function noop() {}

function bindRuntimeStateSubscription({
  runtime,
  widgetRef,
  adapter,
  view,
  surface,
  spec,
  interactionConfig,
  initialWidgetState,
}) {
  const store = runtime?.store || null
  if (!store || typeof store.subscribe !== 'function') return noop
  if (!widgetRef || typeof adapter?.applyState !== 'function') return noop
  if (!view && !surface) return noop

  let lastAppliedState = initialWidgetState || null

  return store.subscribe(() => {
    const nextWidgetState = store.getWidgetState?.(widgetRef) || null
    if (!nextWidgetState || nextWidgetState === lastAppliedState) return

    lastAppliedState = nextWidgetState
    Promise.resolve(adapter.applyState({
      runtime,
      view,
      surface,
      spec,
      state: nextWidgetState,
      interactionConfig,
    })).catch(() => {})
  })
}

export function attachWidgetRendererBridge({
  runtime,
  widgetRef,
  widgetAdapter = null,
  widgetState,
  view,
  surface,
  spec,
  interactionConfig,
  selectionSourceWidgetId,
  actionTargetRef,
  onActionCall,
  onSelectionChange,
  bindHumanInteractions = true,
}) {
  const adapter = widgetAdapter || runtime?.store?.getWidgetAdapter?.(widgetRef) || null

  const bindCleanup = bindHumanInteractions
    ? adapter?.bindHumanInteractions?.({
      view,
      surface,
      spec,
      state: widgetState,
      interactionConfig,
      selectionSourceWidgetId,
      actionTargetRef,
      onActionCall,
      onSelectionChange,
    }) || noop
    : noop

  const unsubscribe = bindRuntimeStateSubscription({
    runtime,
    widgetRef,
    adapter,
    view,
    surface,
    spec,
    interactionConfig,
    initialWidgetState: widgetState,
  })

  return {
    adapter,
    cleanup() {
      if (typeof bindCleanup === 'function') {
        bindCleanup()
      }
      unsubscribe()
    },
  }
}

export async function applyWidgetRuntimeState({
  runtime,
  widgetRef,
  widgetAdapter = null,
  widgetState,
  view,
  surface,
  spec,
  interactionConfig,
}) {
  const adapter = widgetAdapter || runtime?.store?.getWidgetAdapter?.(widgetRef) || null
  if (!adapter?.applyState || !widgetState || (!view && !surface)) return
  await adapter.applyState({
    runtime,
    view,
    surface,
    spec,
    state: widgetState,
    interactionConfig,
  })
}

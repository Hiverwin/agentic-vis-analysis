export function buildHumanActionCall({ name, actionTargetRef, params }) {
  return {
    callId: `human_${Date.now()}`,
    name,
    actor: 'human',
    targetRef: actionTargetRef || undefined,
    params: {
      targetRef: actionTargetRef || undefined,
      ...params,
    },
  }
}

export function resolveCategoryField({ spec, interactionConfig, selection = null }) {
  if (typeof selection?.field === 'string' && selection.field.length > 0) return selection.field
  const enc = spec?.encoding || {}
  const preferredChannel = interactionConfig?.categoryFieldChannel
  if (preferredChannel && enc?.[preferredChannel]?.field) return enc[preferredChannel].field
  if (typeof interactionConfig?.categoryField === 'string' && interactionConfig.categoryField.length > 0) {
    return interactionConfig.categoryField
  }
  return enc.color?.field || enc.shape?.field || enc.detail?.field || enc.key?.field || enc.x?.field || enc.y?.field || null
}

export function resolveCellFields({ spec, interactionConfig, selection = null }) {
  return {
    xField: selection?.xField || interactionConfig?.xField || spec?.encoding?.x?.field || null,
    yField: selection?.yField || interactionConfig?.yField || spec?.encoding?.y?.field || null,
  }
}

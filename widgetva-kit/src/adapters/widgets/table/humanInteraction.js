export function getTableHumanInteractionConfig() {
  return {
    mode: 'rowClick',
    actionName: 'table.focusRows',
    supportsDirectManipulation: true,
  }
}

export function bindTableHumanInteractions({
  surface,
  state,
  interactionConfig,
  onActionCall,
}) {
  if (!surface || !interactionConfig || interactionConfig.mode !== 'rowClick' || typeof onActionCall !== 'function') {
    return () => {}
  }

  const handleClick = (event) => {
    const rowElement = event.target instanceof Element
      ? event.target.closest?.('[data-widgetva-row-index]')
      : null
    if (!rowElement) return

    const rowIndex = Number(rowElement.getAttribute('data-widgetva-row-index'))
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return

    const rows = Array.isArray(state?.rawSpec?.data?.values) ? state.rawSpec.data.values : []
    const row = rows[rowIndex]
    if (!row || typeof row !== 'object') return

    const columns = Array.isArray(state?.rawSpec?.columns) ? state.rawSpec.columns : []
    const keyField = interactionConfig.keyField || columns[0] || null
    const key = keyField ? row?.[keyField] : null
    if (!keyField || key == null) return

    onActionCall({
      callId: `human_${Date.now()}`,
      name: interactionConfig.actionName || 'table.focusRows',
      actor: 'human',
      targetRef: state?.ref || undefined,
      params: {
        targetRef: state?.ref || undefined,
        keyField,
        keys: [key],
      },
    })
  }

  surface.addEventListener('click', handleClick)
  return () => surface.removeEventListener('click', handleClick)
}

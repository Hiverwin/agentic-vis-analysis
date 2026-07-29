import { cloneJsonValue as cloneValue } from '../../../../shared/clone.js'
function normalizeScalarArray(values) {
  if (!Array.isArray(values)) return undefined
  const normalized = values.filter((value) => typeof value === 'string' || typeof value === 'number')
  return normalized.length > 0 ? normalized : undefined
}

function normalizeFieldArray(fields) {
  if (!Array.isArray(fields)) return undefined
  const normalized = fields.filter((field) => typeof field === 'string' && field.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function buildSelectionStateInput(selection) {
  if (!selection || typeof selection !== 'object') return null

  const nextState = {
    selectionRef: normalizeString(selection.selection_ref) || normalizeString(selection.selectionRef),
    selectionId: normalizeString(selection.selection_id) || normalizeString(selection.selectionId),
    kind: selection.selection_type || selection.kind || 'interval',
    sourceWidgetRef: normalizeString(selection.source_widget_ref) || normalizeString(selection.sourceWidgetRef),
    sourceWidgetId: normalizeString(selection.source_widget_id) || normalizeString(selection.sourceWidgetId),
    scope: normalizeString(selection.scope) || 'local',
    selectionDataRef: normalizeString(selection.selection_data_ref) || normalizeString(selection.selectionDataRef),
    domain: selection.domain || null,
    predicates: Array.isArray(selection.predicates) ? cloneValue(selection.predicates) : [],
    summary: typeof selection.summary === 'string' ? selection.summary : '',
  }

  if (typeof selection.aggregateName === 'string' && selection.aggregateName.length > 0) {
    nextState.aggregateName = selection.aggregateName
  }

  const fields = normalizeFieldArray(selection.fields)
  if (fields) nextState.fields = fields

  if (selection.value && typeof selection.value === 'object' && !Array.isArray(selection.value)) {
    nextState.value = cloneValue(selection.value)
  }

  if (typeof selection.keyField === 'string' && selection.keyField.length > 0) {
    nextState.keyField = selection.keyField
  }

  const keys = normalizeScalarArray(selection.keys)
  if (keys) nextState.keys = keys

  if (typeof selection.field === 'string' && selection.field.length > 0) {
    nextState.field = selection.field
  }

  const values = normalizeScalarArray(selection.values)
  if (values) nextState.values = values

  return nextState
}

export function buildSelectionPayloadFromState({ selectionRef, selectionState, sourceWidgetId, selectedCount = 0 }) {
  if (!selectionState) return null

  const normalizedSelectionRef = typeof selectionRef === 'string' ? selectionRef : (selectionState.selectionRef || null)
  const normalizedSelectionId = selectionState.selectionId
    || (typeof normalizedSelectionRef === 'string' ? normalizedSelectionRef.split('/').pop() || null : null)
    || `sel_${Date.now()}`
  const normalizedSourceWidgetId = sourceWidgetId || selectionState.sourceWidgetId || undefined
  const payload = {
    selection_ref: normalizedSelectionRef || undefined,
    selection_id: normalizedSelectionId,
    source_widget_ref: selectionState.sourceWidgetRef || undefined,
    source_widget_id: normalizedSourceWidgetId,
    selection_type: selectionState.kind || 'interval',
    scope: selectionState.scope || 'local',
    selection_data_ref: selectionState.selectionDataRef || undefined,
    domain: selectionState.domain || null,
    predicates: Array.isArray(selectionState.predicates) ? cloneValue(selectionState.predicates) : [],
    count: selectedCount,
    summary: selectionState.summary || '',
  }

  if (typeof selectionState.aggregateName === 'string' && selectionState.aggregateName.length > 0) {
    payload.aggregateName = selectionState.aggregateName
  }

  const fields = normalizeFieldArray(selectionState.fields)
  if (fields) payload.fields = fields

  if (
    selectionState.value
    && typeof selectionState.value === 'object'
    && !Array.isArray(selectionState.value)
    && Object.keys(selectionState.value).length > 0
  ) {
    payload.value = cloneValue(selectionState.value)
  }

  if (typeof selectionState.keyField === 'string' && selectionState.keyField.length > 0) {
    payload.keyField = selectionState.keyField
  }

  const keys = normalizeScalarArray(selectionState.keys)
  if (keys) payload.keys = keys

  if (typeof selectionState.field === 'string' && selectionState.field.length > 0) {
    payload.field = selectionState.field
  }

  const values = normalizeScalarArray(selectionState.values)
  if (values) payload.values = values

  return payload
}

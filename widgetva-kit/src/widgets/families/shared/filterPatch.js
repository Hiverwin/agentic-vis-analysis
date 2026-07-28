import { makeTransformState } from '../../../contracts/state-contracts.js'

export function buildWidgetFilterPatch({
  targetWidget,
  currentState,
  actionName,
  field,
  fields,
  predicates,
  values,
  value,
  range,
  visibleCount = null,
}) {
  const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget || {}
  const nextTransform = makeTransformState({
    kind: 'filter',
    source: 'action',
    sourceWidgetId: targetWidget.widgetId || null,
    ref: `${targetWidget.ref}/transform/${actionName}`,
    spec: {
      actionName,
      ...(field ? { field } : {}),
      ...(Array.isArray(fields) && fields.length > 0 ? { fields } : {}),
      ...(values !== undefined ? { values } : {}),
      ...(value !== undefined ? { value } : {}),
      ...(range !== undefined ? { range } : {}),
      predicates: Array.isArray(predicates) ? predicates : [],
    },
  })
  const existingTransforms = Array.isArray(currentWidgetState?.transforms) ? currentWidgetState.transforms : []
  const nextTransforms = [
    ...existingTransforms.filter((transform) => !(
      transform?.kind === 'filter'
      && transform?.source === 'action'
      && transform?.spec?.actionName === actionName
    )),
    nextTransform,
  ]

  return {
    [targetWidget.ref]: {
      transforms: nextTransforms,
      data: {
        ...(currentWidgetState?.data || {}),
        ...(Number.isFinite(visibleCount) ? { visibleCount } : {}),
      },
    },
  }
}

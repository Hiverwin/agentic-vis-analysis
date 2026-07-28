import { makeTransformState } from '../../../contracts/state-contracts.js'
import { buildWidgetSelectionPatch } from '../shared/selectionPatch.js'

function replaceActionTransform(transforms, actionName, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !(
    transform?.source === 'action'
    && transform?.spec?.actionName === actionName
  ))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

export function readCurrentWidgetState(currentState, targetWidget) {
  return currentState?.widgets?.[targetWidget.ref] || targetWidget || {}
}

export function buildBarCategorySelectionPatch({
  targetWidget,
  currentState,
  actionName,
  field,
  values,
  selectedCount,
}) {
  return buildWidgetSelectionPatch({
    targetWidget,
    currentState,
    selection: {
      selection_id: field,
      source_widget_id: targetWidget.widgetId || undefined,
      selection_type: 'category',
      field,
      values,
      predicates: [{ field, op: 'in', value: values }],
      count: selectedCount,
      summary: `${field}: ${values.join(', ')}`,
    },
  })
}

export function buildBarVisibilityPatch({
  targetWidget,
  currentState,
  actionName,
  field,
  visibleValues,
  operation,
  changedValues,
  rows,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const visibleCount = rows.filter((row) => visibleValues.includes(row?.[field])).length
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'filter',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            field,
            values: visibleValues,
            predicates: [{ field, op: 'in', value: visibleValues }],
            operation,
            changedValues,
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        visibleCount,
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          visibility: {
            sourceAction: actionName,
            mode: 'category',
            field,
            visibleValues,
            operation,
            changedValues,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        addRemove: {
          mode: 'categoryVisibility',
          sourceAction: actionName,
          field,
          visibleValues,
          operation,
          changedValues,
        },
      },
    },
  }
}

export function buildBarItemVisibilityPatch({
  targetWidget,
  currentState,
  actionName,
  xField,
  subField,
  visibleItems,
  operation,
  changedItems,
  rows,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const visibleKeys = new Set(visibleItems.map((item) => JSON.stringify([item.x, item.sub])))
  const visibleCount = rows.filter((row) => visibleKeys.has(JSON.stringify([row?.[xField], row?.[subField]]))).length
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'filter',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            fields: [xField, subField],
            values: visibleItems,
            predicates: [{ fields: [xField, subField], op: 'tupleIn', value: visibleItems }],
            operation,
            changedItems,
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        visibleCount,
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          visibility: {
            sourceAction: actionName,
            mode: 'item',
            xField,
            subField,
            visibleItems,
            operation,
            changedItems,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        addRemove: {
          mode: 'itemVisibility',
          sourceAction: actionName,
          xField,
          subField,
          visibleItems,
          operation,
          changedItems,
        },
      },
    },
  }
}

export function buildBarExpandStackPatch({
  targetWidget,
  currentState,
  category,
  categoryField,
  subField,
}) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'bar.expandStack'
  return {
    [targetWidget.ref]: {
      transforms: replaceActionTransform(
        currentWidgetState.transforms,
        actionName,
        makeTransformState({
          kind: 'filter',
          source: 'action',
          sourceWidgetId: targetWidget.widgetId || null,
          spec: {
            actionName,
            field: categoryField,
            values: [category],
            predicates: [{ field: categoryField, op: 'in', value: [category] }],
          },
        }),
      ),
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          expandStack: {
            sourceAction: actionName,
            category,
            categoryField,
            subField,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'expandStack',
          sourceAction: actionName,
          category,
          categoryField,
          subField,
        },
      },
    },
  }
}

export function buildBarStackModePatch({ targetWidget, currentState, mode, subField }) {
  const currentWidgetState = readCurrentWidgetState(currentState, targetWidget)
  const actionName = 'bar.toggleStackMode'
  return {
    [targetWidget.ref]: {
      data: {
        ...(currentWidgetState.data || {}),
        analysis: {
          ...(currentWidgetState.data?.analysis || {}),
          stackMode: {
            sourceAction: actionName,
            mode,
            subField,
          },
        },
      },
      view: {
        ...(currentWidgetState.view || {}),
        reencode: {
          mode: 'stackMode',
          sourceAction: actionName,
          layout: mode,
          subField,
        },
      },
    },
  }
}

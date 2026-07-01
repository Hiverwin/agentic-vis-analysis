import { getWidgetActionPrimitive } from '../../widgets/actionPrimitiveMap.js'

const WORKSPACE_SHARED_STATE_BY_PRIMITIVE = {
  select: {
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedSemanticFocus',
    stateField: 'selections',
  },
  filter: {
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedFilterContext',
    stateField: 'filters',
  },
  focus: {
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedSemanticFocus',
    stateField: 'focus',
  },
  highlight: {
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedSemanticFocus',
    stateField: 'highlight',
  },
  zoom: {
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedViewportContext',
    stateField: 'viewport',
  },
}

const LOCAL_SHARED_SUMMARY_BY_PRIMITIVE = {
  sort: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
  drillDown: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
  aggregate: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
  reencode: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
  annotate: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
  navigate: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
  addRemove: {
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  },
}

export function classifyPrimitiveAnalyticalPlacement(primitive = null) {
  if (typeof primitive !== 'string' || primitive.length === 0) {
    return {
      primitive: null,
      placement: 'unknown',
      sharedSurface: null,
      stateField: null,
    }
  }

  const workspaceShared = WORKSPACE_SHARED_STATE_BY_PRIMITIVE[primitive]
  if (workspaceShared) {
    return {
      primitive,
      ...workspaceShared,
    }
  }

  const localSharedSummary = LOCAL_SHARED_SUMMARY_BY_PRIMITIVE[primitive]
  if (localSharedSummary) {
    return {
      primitive,
      ...localSharedSummary,
    }
  }

  return {
    primitive,
    placement: 'unknown',
    sharedSurface: null,
    stateField: null,
  }
}

export function classifyActionAnalyticalPlacement(actionName = null) {
  const primitive = getWidgetActionPrimitive(actionName)
  return {
    actionName: typeof actionName === 'string' ? actionName : null,
    ...classifyPrimitiveAnalyticalPlacement(primitive),
  }
}

export function applyActionAnalyticalPlacement(descriptor = null) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    return descriptor
  }

  const placement = classifyActionAnalyticalPlacement(descriptor?.name)
  if (placement.placement === 'unknown') {
    return {
      ...descriptor,
    }
  }

  return {
    ...descriptor,
    analyticalPlacement: placement.placement,
    sharedAnalyticalSurface: placement.sharedSurface,
  }
}

export function applyActionAnalyticalPlacementList(descriptors = []) {
  return Array.isArray(descriptors)
    ? descriptors.map((descriptor) => applyActionAnalyticalPlacement(descriptor))
    : []
}

export function listAnalyticalPlacementRules() {
  return [
    ...Object.keys(WORKSPACE_SHARED_STATE_BY_PRIMITIVE),
    ...Object.keys(LOCAL_SHARED_SUMMARY_BY_PRIMITIVE),
  ].map((primitive) => classifyPrimitiveAnalyticalPlacement(primitive))
}

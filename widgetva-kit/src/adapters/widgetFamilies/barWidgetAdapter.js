import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import { bindWidgetHumanInteractions } from '../humanInteractionBindings.js'
import {
  buildBarActionDescriptors,
  buildBarPerceptionDescriptors,
  registerBarActions,
  registerBarPerceptionQueries,
} from '../../widgets/bar/index.js'
import { getBarHumanInteractionConfig } from '../widgets/bar/humanInteraction.js'
import { applyBarState } from '../widgets/bar/state.js'

export const barWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'bar',

  bindHumanInteractions({ view, spec, interactionConfig, selectionSourceWidgetId, actionTargetRef, onActionCall, onSelectionChange }) {
    return bindWidgetHumanInteractions({
      view,
      spec,
      interactionConfig,
      selectionSourceWidgetId,
      actionTargetRef,
      onActionCall,
      onSelectionChange,
    })
  },

  async applyState(args) {
    return applyBarState(args)
  },

  buildActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
    return buildBarActionDescriptors({ widgetRef, selectionRef, scope, affectedRefs })
  },

  buildPerceptionDescriptors({ dataRef }) {
    return buildBarPerceptionDescriptors({ dataRef })
  },

  getHumanInteractionConfig() {
    return getBarHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerBarActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerBarPerceptionQueries(perceptionRegistry)
  },
})

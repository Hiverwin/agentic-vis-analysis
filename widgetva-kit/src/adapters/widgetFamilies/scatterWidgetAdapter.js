import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import { bindWidgetHumanInteractions } from '../humanInteractionBindings.js'
import {
  buildScatterActionDescriptors,
  buildScatterPerceptionDescriptors,
  registerScatterActions,
  registerScatterPerceptionQueries,
} from '../../widgets/scatter/index.js'
import { getScatterHumanInteractionConfig } from '../widgets/scatter/humanInteraction.js'
import { applyScatterState } from '../widgets/scatter/state.js'

export const scatterWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'scatter',

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

  async applyState({ view, state }) {
    return applyScatterState({ view, state })
  },

  buildActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
    return buildScatterActionDescriptors({ widgetRef, selectionRef, scope, affectedRefs })
  },

  buildPerceptionDescriptors({ dataRef }) {
    return buildScatterPerceptionDescriptors({ dataRef })
  },

  getHumanInteractionConfig() {
    return getScatterHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerScatterActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerScatterPerceptionQueries(perceptionRegistry)
  },
})

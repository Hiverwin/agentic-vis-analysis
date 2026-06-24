import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import {
  buildLineActionDescriptors,
  buildLinePerceptionDescriptors,
  registerLineActions,
  registerLinePerceptionQueries,
} from '../../widgets/line/index.js'
import { getLineHumanInteractionConfig } from '../widgets/line/humanInteraction.js'
import { applyLineState } from '../widgets/line/state.js'

export const lineWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'line',

  async applyState(args) {
    return applyLineState(args)
  },

  buildActionDescriptors(args) {
    return buildLineActionDescriptors(args)
  },

  buildPerceptionDescriptors(args) {
    return buildLinePerceptionDescriptors(args)
  },

  getHumanInteractionConfig() {
    return getLineHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerLineActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerLinePerceptionQueries(perceptionRegistry)
  },
})

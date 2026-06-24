import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import {
  buildSankeyActionDescriptors,
  buildSankeyPerceptionDescriptors,
  registerSankeyActions,
  registerSankeyPerceptionQueries,
} from '../../widgets/sankey/index.js'
import { getSankeyHumanInteractionConfig } from '../widgets/sankey/humanInteraction.js'
import { applySankeyState } from '../widgets/sankey/state.js'

export const sankeyWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'sankey',

  async applyState(args) {
    return applySankeyState(args)
  },

  buildActionDescriptors(args) {
    return buildSankeyActionDescriptors(args)
  },

  buildPerceptionDescriptors(args) {
    return buildSankeyPerceptionDescriptors(args)
  },

  getHumanInteractionConfig() {
    return getSankeyHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerSankeyActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerSankeyPerceptionQueries(perceptionRegistry)
  },
})

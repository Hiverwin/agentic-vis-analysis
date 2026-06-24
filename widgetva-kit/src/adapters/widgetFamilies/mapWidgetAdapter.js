import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import {
  applyMapState,
  buildMapActionDescriptors,
  buildMapPerceptionDescriptors,
  getMapHumanInteractionConfig,
  registerMapActions,
  registerMapPerceptionQueries,
} from '../widgets/map/index.js'

export const mapWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'map',

  async applyState(args) {
    return applyMapState(args)
  },

  buildActionDescriptors(args) {
    return buildMapActionDescriptors(args)
  },

  buildPerceptionDescriptors(args) {
    return buildMapPerceptionDescriptors(args)
  },

  getHumanInteractionConfig() {
    return getMapHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerMapActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerMapPerceptionQueries(perceptionRegistry)
  },
})

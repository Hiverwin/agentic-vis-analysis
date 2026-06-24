import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import {
  buildHeatmapActionDescriptors,
  buildHeatmapPerceptionDescriptors,
  registerHeatmapActions,
  registerHeatmapPerceptionQueries,
} from '../../widgets/heatmap/index.js'
import { getHeatmapHumanInteractionConfig } from '../widgets/heatmap/humanInteraction.js'
import { applyHeatmapState } from '../widgets/heatmap/state.js'

export const heatmapWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'heatmap',

  async applyState(args) {
    return applyHeatmapState(args)
  },

  buildActionDescriptors(args) {
    return buildHeatmapActionDescriptors(args)
  },

  buildPerceptionDescriptors(args) {
    return buildHeatmapPerceptionDescriptors(args)
  },

  getHumanInteractionConfig() {
    return getHeatmapHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerHeatmapActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerHeatmapPerceptionQueries(perceptionRegistry)
  },
})

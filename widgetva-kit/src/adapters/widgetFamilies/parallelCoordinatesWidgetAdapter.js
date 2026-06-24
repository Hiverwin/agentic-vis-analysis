import { createVegaLiteWidgetAdapter } from '../VegaLiteWidgetAdapter.js'
import {
  buildParallelCoordinatesActionDescriptors,
  buildParallelCoordinatesPerceptionDescriptors,
  registerParallelCoordinatesActions,
  registerParallelCoordinatesPerceptionQueries,
} from '../../widgets/parallelCoordinates/index.js'
import { getParallelCoordinatesHumanInteractionConfig } from '../widgets/parallelCoordinates/humanInteraction.js'
import { applyParallelCoordinatesState } from '../widgets/parallelCoordinates/state.js'

export const parallelCoordinatesWidgetAdapter = createVegaLiteWidgetAdapter({
  kind: 'parallelCoordinates',

  async applyState(args) {
    return applyParallelCoordinatesState(args)
  },

  buildActionDescriptors(args) {
    return buildParallelCoordinatesActionDescriptors(args)
  },

  buildPerceptionDescriptors(args) {
    return buildParallelCoordinatesPerceptionDescriptors(args)
  },

  getHumanInteractionConfig() {
    return getParallelCoordinatesHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerParallelCoordinatesActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerParallelCoordinatesPerceptionQueries(perceptionRegistry)
  },
})

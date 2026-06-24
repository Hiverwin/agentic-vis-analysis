import { createCustomWidgetAdapter } from '../CustomWidgetAdapter.js'
import {
  applyTableState,
  bindTableHumanInteractions,
  buildTableActionDescriptors,
  buildTablePerceptionDescriptors,
  getTableHumanInteractionConfig,
  registerTableActions,
  registerTablePerceptionQueries,
} from '../widgets/table/index.js'

export const tableWidgetAdapter = createCustomWidgetAdapter({
  kind: 'table',

  bindHumanInteractions(args) {
    return bindTableHumanInteractions(args)
  },

  async applyState(args) {
    return applyTableState(args)
  },

  buildActionDescriptors(args) {
    return buildTableActionDescriptors(args)
  },

  buildPerceptionDescriptors(args) {
    return buildTablePerceptionDescriptors(args)
  },

  getHumanInteractionConfig() {
    return getTableHumanInteractionConfig()
  },

  registerActions(actionExecutor) {
    return registerTableActions(actionExecutor)
  },

  registerPerceptionQueries(perceptionRegistry) {
    return registerTablePerceptionQueries(perceptionRegistry)
  },
})

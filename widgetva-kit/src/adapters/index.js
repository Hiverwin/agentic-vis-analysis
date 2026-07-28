export {
  installWidgetVAOnView,
  installWidgetVAOnVegaLiteView,
  installWidgetVAOnD3View,
  installWidgetVAOnEChartsView,
  installWidgetVAOnVgplotView,
} from './installWidgetView.js'
export { createRendererAdapterRegistry } from '../core/rendering/RendererAdapterRegistry.js'
export { createWidgetVAViewAdapter } from '../integrations/providerViewAdapters.js'
export { executeProviderSpecAction } from './vegaLite/vegaLiteSpecActionExecutor.js'

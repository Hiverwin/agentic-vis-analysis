export {
  attachWidgetVAToVegaLiteExample,
  attachWidgetVAToCapturedVegaLiteExample,
  attachWidgetVAToCurrentVegaLiteExamplePage,
  bootstrapCurrentVegaLiteExamplePage,
  extractVegaLiteExampleSpecFromHtml,
  extractVegaLiteExampleSpecFromText,
  inferWidgetKindFromVegaLiteSpec,
  isVegaLiteExamplesPage,
  normalizeVegaLiteExampleSpec,
  readVegaLiteExampleIntegrationInput,
  waitForCapturedVegaLiteExample,
} from './integrations/officialPages/vegaLiteExamples.js'

export {
  installVegaEmbedCapture,
  readLatestVegaEmbedCapture,
} from './integrations/officialPages/vegaEmbedCapture.js'

export {
  describeObservableD3PageShape,
  findObservableWorkerFrame,
  isObservableD3NotebookPage,
  isObservableWorkerFrameUrl,
  parseObservableNotebookIdentity,
  waitForObservableWorkerFrame,
} from './integrations/officialPages/observableD3Pages.js'

export {
  describeObservableD3Surface,
  findPrimaryObservableD3Surface,
  findObservableD3PointMarks,
  inferObservableD3WidgetKindFromSurface,
  readObservableD3ScatterRows,
  summarizeObservableD3ScatterRows,
  summarizeObservableD3Surface,
  waitForObservableD3Surface,
} from './integrations/officialPages/observableD3Surface.js'

export {
  attachWidgetVAToObservableD3ScatterPage,
  bootstrapObservableD3ScatterPage,
  createObservableScatterSurfaceWrapper,
} from './integrations/officialPages/observableD3Examples.js'

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
  findObservableD3BarMarks,
  findObservableD3LinePaths,
  describeObservableD3Surface,
  findObservableD3MarkContainer,
  findPrimaryObservableD3Surface,
  findObservableD3PointMarks,
  findObservableD3PlotRegion,
  inferObservableD3WidgetKindFromSurface,
  readObservableD3BarRows,
  readObservableD3LineRows,
  readObservableD3LineSeriesLabels,
  readObservableD3LineXAxisLabels,
  readObservableD3ScatterRows,
  summarizeObservableD3ScatterRows,
  summarizeObservableD3Surface,
  waitForObservableD3Surface,
} from './integrations/officialPages/observableD3Surface.js'

export {
  attachWidgetVAToObservableD3BarPage,
  attachWidgetVAToObservableD3LinePage,
  attachWidgetVAToObservableD3Page,
  attachWidgetVAToObservableD3ScatterPage,
  bootstrapObservableD3Page,
  bootstrapObservableD3ScatterPage,
  createObservableBarSurfaceWrapper,
  createObservableLineSurfaceWrapper,
  createObservableScatterSurfaceWrapper,
} from './integrations/officialPages/observableD3Examples.js'

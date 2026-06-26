import {
  bootstrapCurrentVegaLiteExamplePage,
  installVegaEmbedCapture,
  isVegaLiteExamplesPage,
} from 'widgetva-kit/page-integrations'

import { ensureVegaExamplesPageBootstrap } from './vegaExamplesBootstrap.js'

async function startWidgetVAOnOfficialVegaExamples() {
  return ensureVegaExamplesPageBootstrap({
    root: window,
    isSupportedPage: isVegaLiteExamplesPage,
    installCapture: installVegaEmbedCapture,
    bootstrapPage: bootstrapCurrentVegaLiteExamplePage,
    timeoutMs: 15000,
  })
}

void startWidgetVAOnOfficialVegaExamples().catch((error) => {
  console.error('[WidgetVA] Failed to bootstrap on the official Vega-Lite examples page.', error)
})

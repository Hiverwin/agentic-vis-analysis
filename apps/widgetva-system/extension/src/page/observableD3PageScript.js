import {
  bootstrapObservableD3ScatterPage,
  describeObservableD3PageShape,
  isObservableD3NotebookPage,
  waitForObservableWorkerFrame,
} from 'widgetva-kit/page-integrations'

import { ensureObservableD3PageBootstrap } from './observableD3Bootstrap.js'

async function startWidgetVAOnObservableD3Pages() {
  window.__widgetVAOfficialPageBootstrap = window.__widgetVAOfficialPageBootstrap || {}
  window.__widgetVAOfficialPageBootstrap.observableD3 = {
    provider: 'd3',
    pageType: 'official-observable-notebook',
    status: 'booting',
  }

  return ensureObservableD3PageBootstrap({
    root: window,
    isSupportedPage: isObservableD3NotebookPage,
    describePage: describeObservableD3PageShape,
    waitForWorkerFrame: waitForObservableWorkerFrame,
    bootstrapPage: bootstrapObservableD3ScatterPage,
    timeoutMs: 15000,
  })
}

void startWidgetVAOnObservableD3Pages().catch((error) => {
  window.__widgetVAOfficialPageBootstrap = window.__widgetVAOfficialPageBootstrap || {}
  window.__widgetVAOfficialPageBootstrap.observableD3 = {
    provider: 'd3',
    pageType: 'official-observable-notebook',
    status: 'error',
    error: {
      name: error?.name || 'Error',
      message: error?.message || String(error),
    },
  }
  console.error('[WidgetVA] Failed to bootstrap on the official Observable D3 page.', error)
})

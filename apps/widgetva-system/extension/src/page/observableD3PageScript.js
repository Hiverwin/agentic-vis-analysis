import {
  bootstrapObservableD3Page,
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
    bootstrapPage: bootstrapObservableD3Page,
    timeoutMs: 15000,
  })
}

function recordObservableD3BootstrapError(error) {
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
}

function createObservableD3RouteWatcher() {
  let lastHref = window.location.href
  let scheduled = false

  const runBootstrap = async () => {
    try {
      await startWidgetVAOnObservableD3Pages()
    } catch (error) {
      recordObservableD3BootstrapError(error)
    }
  }

  const scheduleBootstrap = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      const currentHref = window.location.href
      if (currentHref === lastHref) return
      lastHref = currentHref
      void runBootstrap()
    })
  }

  const wrapHistoryMethod = (name) => {
    const original = window.history?.[name]
    if (typeof original !== 'function') return
    window.history[name] = function wrappedHistoryMethod(...args) {
      const result = original.apply(this, args)
      scheduleBootstrap()
      return result
    }
  }

  wrapHistoryMethod('pushState')
  wrapHistoryMethod('replaceState')
  window.addEventListener('popstate', scheduleBootstrap)
  window.addEventListener('hashchange', scheduleBootstrap)
}

createObservableD3RouteWatcher()
void startWidgetVAOnObservableD3Pages().catch(recordObservableD3BootstrapError)

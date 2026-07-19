import { installOfficialPageAgentBridge } from './installOfficialPageAgentBridge.js'
import { installWidgetVADock } from './dock/installWidgetVADock.js'

export const WIDGETVA_LOAD_OFFICIAL_VEGA_LITE_PAGE = 'widgetva:load-official-vega-lite-page'

const PAGE_SCRIPT_ID = 'widgetva-official-vega-lite-page-script'
const PAGE_SCRIPT_PATH = 'officialVegaLitePageScript.js'
let pageScriptPromise = null

function injectPageScript() {
  if (pageScriptPromise) {
    return pageScriptPromise
  }

  pageScriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById(PAGE_SCRIPT_ID)) {
      resolve()
      return
    }

    const pageScriptUrl = globalThis.chrome?.runtime?.getURL?.(PAGE_SCRIPT_PATH)
    if (!pageScriptUrl) {
      reject(new Error('Unable to resolve the official Vega-Lite page-script URL from the extension runtime.'))
      return
    }

    const script = document.createElement('script')
    script.id = PAGE_SCRIPT_ID
    script.src = pageScriptUrl
    script.async = false

    script.addEventListener('load', () => {
      script.remove()
      resolve()
    }, { once: true })
    script.addEventListener('error', () => {
      script.remove()
      pageScriptPromise = null
      reject(new Error('Failed to inject the official Vega-Lite page script.'))
    }, { once: true })

    const target = document.documentElement || document.head
    if (!target) {
      pageScriptPromise = null
      reject(new Error('Unable to inject the official Vega-Lite page script because no root element is available.'))
      return
    }

    target.prepend(script)
  })

  return pageScriptPromise
}

function summarizeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'WidgetVA failed to load.'),
  }
}

export function createOfficialVegaLitePageLoadHandler({
  root = window,
  installBridge = installOfficialPageAgentBridge,
  installDock = installWidgetVADock,
  ensurePageScript = injectPageScript,
} = {}) {
  let dockController = null

  return async function loadOfficialVegaLitePage(message = {}) {
    if (!message || message.type !== WIDGETVA_LOAD_OFFICIAL_VEGA_LITE_PAGE) {
      return null
    }

    installBridge(root)
    dockController = installDock({
      routeLabel: 'Vega-Lite official page',
      provider: 'vega-lite',
      root,
      ensurePageScript,
      openOnInstall: true,
    }) || dockController

    if (!dockController) {
      throw new Error('WidgetVA Dock could not be installed on this page.')
    }

    if (typeof dockController.open === 'function') {
      dockController.open()
    }

    if (message.autoBind !== false && typeof dockController.bind === 'function') {
      await dockController.bind()
    }

    return {
      loaded: true,
      bound: typeof dockController.isBound === 'function' ? dockController.isBound() : null,
    }
  }
}

export function installOfficialVegaLitePageLoadListener({
  root = window,
  runtime = globalThis.chrome?.runtime,
} = {}) {
  if (!runtime || typeof runtime.onMessage?.addListener !== 'function') {
    return null
  }

  const loadPage = createOfficialVegaLitePageLoadHandler({ root })
  const listener = (message, _sender, sendResponse) => {
    if (!message || message.type !== WIDGETVA_LOAD_OFFICIAL_VEGA_LITE_PAGE) {
      return false
    }

    loadPage(message)
      .then((result) => {
        sendResponse({ ok: true, result })
      })
      .catch((error) => {
        sendResponse({ ok: false, error: summarizeError(error) })
      })
    return true
  }

  runtime.onMessage.addListener(listener)
  return listener
}

if (typeof window !== 'undefined') {
  installOfficialVegaLitePageLoadListener({ root: window })
}

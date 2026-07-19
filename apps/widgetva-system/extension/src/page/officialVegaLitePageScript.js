import {
  isOfficialVegaLiteGalleryPage,
  readGenericVegaLiteIntegrationInput,
  attachWidgetVAToCapturedVegaLiteView,
  attachWidgetVAToVegaLiteView,
  bootstrapCurrentCapturedVegaLitePage,
} from '../../../../../widgetva-kit/src/integrations/officialPages/officialVegaLitePageIntegrations.js'
import { readLatestVegaEmbedCapture, installVegaEmbedCapture } from '../../../../../widgetva-kit/src/integrations/officialPages/vegaEmbedCapture.js'

import { ensureOfficialVegaLitePageBootstrap } from './officialVegaLitePageBootstrap.js'
import { installOfficialPageDockBridge } from './officialPageDockBridge.js'

export function installVegaLiteDevHelpers(root = window) {
  const helpers = {
    installVegaEmbedCapture: (...args) => installVegaEmbedCapture(...args),
    readLatestVegaEmbedCapture: (...args) => readLatestVegaEmbedCapture(...args),
    readGenericVegaLiteIntegrationInput: (...args) => readGenericVegaLiteIntegrationInput(...args),
    attachWidgetVAToVegaLiteView: (...args) => attachWidgetVAToVegaLiteView(...args),
    attachWidgetVAToCapturedVegaLiteView: (...args) => attachWidgetVAToCapturedVegaLiteView(...args),
    async bindCurrentCapturedView(options = {}) {
      return attachWidgetVAToCapturedVegaLiteView({
        root,
        pageUrl: root?.location?.href || '',
        ...(options || {}),
      })
    },
    async bootstrapOfficialPage(options = {}) {
      return ensureOfficialVegaLitePageBootstrap({
        root,
        isSupportedPage: isOfficialVegaLiteGalleryPage,
        installCapture: installVegaEmbedCapture,
        bootstrapPage: bootstrapCurrentCapturedVegaLitePage,
        timeoutMs: 15000,
        ...(options || {}),
      })
    },
  }

  root.__widgetVAPageIntegrations = helpers
  root.__widgetVegaLiteDev = helpers
  return helpers
}

export function installVegaLiteDockBridge(root = window) {
  const helpers = root.__widgetVAPageIntegrations || installVegaLiteDevHelpers(root)
  return installOfficialPageDockBridge(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
    bind: (options = {}) => helpers.bootstrapOfficialPage({
      forceReattach: true,
      ...(options || {}),
    }),
  })
}

export async function startWidgetVAOnOfficialVegaLitePage(options = {}) {
  const helpers = installVegaLiteDevHelpers(window)
  installVegaLiteDockBridge(window)
  return helpers.bootstrapOfficialPage({
    forceReattach: true,
    ...(options || {}),
  })
}

if (typeof window !== 'undefined' && window) {
  installVegaLiteDevHelpers(window)
  installVegaLiteDockBridge(window)
}

export async function bootstrapWidgetVAOnOfficialVegaLitePage(options = {}) {
  return ensureOfficialVegaLitePageBootstrap({
    root: window,
    isSupportedPage: isOfficialVegaLiteGalleryPage,
    installCapture: installVegaEmbedCapture,
    bootstrapPage: bootstrapCurrentCapturedVegaLitePage,
    timeoutMs: 15000,
    forceReattach: true,
    ...(options || {}),
  })
}

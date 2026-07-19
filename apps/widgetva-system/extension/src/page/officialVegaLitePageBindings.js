import {
  bindOfficialPageAgentRuntime,
  clearOfficialPageAgentRuntime,
} from './officialPageRuntimeBindings.js'

export const OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE = '__widgetVAOfficialVegaLitePage'

export function bindOfficialVegaLitePageAgentRuntime(options = {}) {
  return bindOfficialPageAgentRuntime({
    ...options,
    stableSurfaceName: OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE,
    exposeLegacyWindowEntry: false,
    exposeLegacyWindowController: false,
    exposeLegacyWindowHelpers: false,
  })
}

export function clearOfficialVegaLitePageAgentRuntime(options = {}) {
  return clearOfficialPageAgentRuntime(options)
}

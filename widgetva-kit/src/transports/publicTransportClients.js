import { WidgetVAPlaywrightClient } from './playwrightClient.js'
import { createWebSocketTransportClient as createLegacyWebSocketTransportClient } from './webSocketClient.js'
import { createBrowserExtensionTransportClient as createLegacyBrowserExtensionTransportClient } from './browserExtensionClient.js'
import { createWidgetWorkspaceTransportClient } from './widgetWorkspaceTransportSurface.js'

export function createPlaywrightTransportClient(page) {
  return createWidgetWorkspaceTransportClient(new WidgetVAPlaywrightClient(page))
}

export function createWebSocketTransportClient(options = {}) {
  return createWidgetWorkspaceTransportClient(createLegacyWebSocketTransportClient(options))
}

export function createBrowserExtensionTransportClient(options = {}) {
  return createWidgetWorkspaceTransportClient(createLegacyBrowserExtensionTransportClient(options))
}

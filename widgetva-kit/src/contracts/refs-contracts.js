function makeRef({ appId = 'widgetva-app', workspaceId = 'main', path }) {
  const normalized = String(path || '').replace(/^\/+/, '')
  return `wl://${appId}/workspace/${workspaceId}/${normalized}`
}

export function makeWidgetRef({ appId = 'widgetva-app', workspaceId = 'main', widgetId }) {
  return makeRef({ appId, workspaceId, path: `widget/${widgetId}` })
}

export function makeSelectionRef({ appId = 'widgetva-app', workspaceId = 'main', widgetId, selectionId }) {
  return makeRef({ appId, workspaceId, path: `widget/${widgetId}/selection/${selectionId}` })
}

export function makeDataRef({ appId = 'widgetva-app', workspaceId = 'main', dataId }) {
  return makeRef({ appId, workspaceId, path: `data/${dataId}` })
}

export function makeCurrentViewDataRef({ appId = 'widgetva-app', workspaceId = 'main' } = {}) {
  return makeDataRef({ appId, workspaceId, dataId: 'current_view' })
}

export function makeCurrentSelectionDataRef({ appId = 'widgetva-app', workspaceId = 'main' } = {}) {
  return makeDataRef({ appId, workspaceId, dataId: 'current_selection' })
}

export function makeWidgetSelectionDataRef({ appId = 'widgetva-app', workspaceId = 'main', widgetId }) {
  return makeDataRef({ appId, workspaceId, dataId: `${widgetId}_selection` })
}

export function makeSelectionScopedDataRef({
  appId = 'widgetva-app',
  workspaceId = 'main',
  widgetId,
  selectionId,
}) {
  return makeDataRef({ appId, workspaceId, dataId: `${widgetId}_selection_${selectionId}` })
}

export function makeLinkRef({ appId = 'widgetva-app', workspaceId = 'main', linkId }) {
  return makeRef({ appId, workspaceId, path: `link/${linkId}` })
}

export function parseRef(ref) {
  const match = String(ref || '').match(/^wl:\/\/([^/]+)\/workspace\/([^/]+)\/(.+)$/)
  if (!match) return null
  const [, appId, workspaceId, path] = match
  const segments = path.split('/').filter(Boolean)
  const kind = segments.includes('selection') ? 'selection' : segments[0] || null
  return {
    appId,
    workspaceId,
    kind,
    path,
    localId: segments[segments.length - 1] || null,
    segments,
    widgetId: segments[0] === 'widget' ? segments[1] || null : null,
    selectionId: segments.includes('selection') ? segments[segments.indexOf('selection') + 1] || null : null,
    dataId: segments[0] === 'data' ? segments[1] || null : null,
    linkId: segments[0] === 'link' ? segments[1] || null : null,
    actionId: segments[0] === 'action' ? segments[1] || null : null,
  }
}

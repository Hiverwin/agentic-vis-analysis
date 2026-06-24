export const REF_KINDS = ['widget', 'selection', 'data', 'link', 'action']
export const REF_PATTERN = '^wl:\\/\\/[^/]+\\/workspace\\/[^/]+\\/.+$'

export function makeRef({ appId = 'widgetva-app', workspaceId = 'main', path }) {
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

export function makeActionRef({ appId = 'widgetva-app', workspaceId = 'main', actionId }) {
  return makeRef({ appId, workspaceId, path: `action/${actionId}` })
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

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function describeRefSchema() {
  return cloneValue({
    type: 'string',
    pattern: REF_PATTERN,
  })
}

export function describeRefPartsSchema() {
  return cloneValue({
    type: 'object',
    required: ['appId', 'workspaceId', 'kind', 'path', 'localId', 'segments'],
    properties: {
      appId: { type: 'string' },
      workspaceId: { type: 'string' },
      kind: { type: 'string', enum: REF_KINDS },
      path: { type: 'string' },
      localId: { type: ['string', 'null'] },
      segments: { type: 'array', items: { type: 'string' } },
      widgetId: { type: ['string', 'null'] },
      selectionId: { type: ['string', 'null'] },
      dataId: { type: ['string', 'null'] },
      linkId: { type: ['string', 'null'] },
      actionId: { type: ['string', 'null'] },
    },
  })
}

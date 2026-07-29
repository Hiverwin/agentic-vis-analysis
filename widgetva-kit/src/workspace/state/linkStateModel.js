import { cloneJsonValue as clone } from '../../shared/clone.js'
function cloneArray(value) {
  return Array.isArray(value) ? clone(value) : []
}

function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? clone(value)
    : {}
}

export function readLinkDefinitions(shared = {}) {
  return cloneArray(shared?.links?.definitions)
}

export function readLinkTopologyState(shared = {}) {
  return cloneObject(shared?.links?.topology)
}

export function withLinkSubmodel(shared = {}, {
  definitions,
  topology,
} = {}) {
  const previousLinks = shared?.links || {}
  return {
    ...(shared || {}),
    links: {
      ...previousLinks,
      definitions: definitions === undefined ? readLinkDefinitions(shared) : cloneArray(definitions),
      topology: topology === undefined ? readLinkTopologyState(shared) : cloneObject(topology),
    },
  }
}

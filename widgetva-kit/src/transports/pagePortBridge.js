import { PAGE_PORT_ALIASES } from '../core/protocol/pagePort.js'

export const TRANSPORT_PAGE_PORT_ALIASES = Object.keys(PAGE_PORT_ALIASES)

function resolvePagePortMethod(port, alias) {
  if (!port || typeof alias !== 'string' || alias.length === 0) {
    return null
  }

  const aliasedMethod = port[alias]
  if (typeof aliasedMethod === 'function') {
    return aliasedMethod
  }

  const stableMethodName = PAGE_PORT_ALIASES[alias]
  if (typeof stableMethodName === 'string' && typeof port[stableMethodName] === 'function') {
    return port[stableMethodName]
  }

  return null
}

export function getInstalledPagePort(root = window) {
  const port = root?.__widgetVA
  if (!port) {
    throw new Error('WidgetVA page port is not installed.')
  }
  return port
}

export function invokePagePortAlias(alias, args = [], root = window) {
  const port = getInstalledPagePort(root)
  const method = resolvePagePortMethod(port, alias)
  if (typeof method !== 'function') {
    throw new Error(`WidgetVA page port alias is unavailable: ${alias}`)
  }
  const safeArgs = Array.isArray(args) ? args : [args]
  return method(...safeArgs)
}

export async function evaluatePagePortAlias(page, alias, args = []) {
  const safeArgs = Array.isArray(args) ? args : [args]
  return page.evaluate(
    ({ nextAlias, nextArgs }) => {
      const port = window.__widgetVA
      if (!port) {
        throw new Error('WidgetVA page port is not installed.')
      }
      const aliasedMethod = port[nextAlias]
      const stableMethodName = PAGE_PORT_ALIASES[nextAlias]
      const method = typeof aliasedMethod === 'function'
        ? aliasedMethod
        : (typeof stableMethodName === 'string' ? port[stableMethodName] : null)
      if (typeof method !== 'function') {
        throw new Error(`WidgetVA page port alias is unavailable: ${nextAlias}`)
      }
      return method(...nextArgs)
    },
    { nextAlias: alias, nextArgs: safeArgs },
  )
}

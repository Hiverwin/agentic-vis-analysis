import { PAGE_PORT_ALIASES } from '../core/protocol/pagePort.js'

function collectAliasesFromDescription(description, aliasMap) {
  const aliases = new Set()

  for (const alias of Object.keys(description?.aliases || {})) {
    aliases.add(alias)
  }

  for (const descriptor of Object.values(description?.methodDescriptors || {})) {
    if (!descriptor || typeof descriptor !== 'object') continue
    for (const alias of Array.isArray(descriptor.aliases) ? descriptor.aliases : []) {
      if (typeof alias === 'string' && alias.length > 0) {
        aliases.add(alias)
      }
    }
  }

  const methods = Array.isArray(description?.methods) ? description.methods : []
  for (const [alias, methodName] of Object.entries(aliasMap || {})) {
    if (methods.includes(methodName)) {
      aliases.add(alias)
    }
  }

  return aliases
}

function collectAvailableAliases({ pagePortDescription = null } = {}) {
  const aliases = new Set()

  for (const alias of collectAliasesFromDescription(pagePortDescription, PAGE_PORT_ALIASES)) {
    aliases.add(alias)
  }

  return aliases
}

export function filterAvailableWidgetVAMcpTools({
  allTools = [],
  pagePortDescription = null,
} = {}) {
  const availableAliases = collectAvailableAliases({
    pagePortDescription,
  })
  return allTools.filter((tool) => availableAliases.has(tool.name))
}

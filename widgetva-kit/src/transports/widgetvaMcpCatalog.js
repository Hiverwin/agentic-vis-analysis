import {
  PAGE_PORT_ALIASES,
  PAGE_PORT_METHOD_DESCRIPTORS,
} from '../core/protocol/pagePort.js'
import { TRANSPORT_PAGE_PORT_ALIASES } from './pagePortBridge.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function titleFromToolName(name) {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getMethodNameForAlias(alias) {
  return PAGE_PORT_ALIASES[alias] || null
}

function buildMcpTool(alias) {
  const methodName = getMethodNameForAlias(alias)
  if (!methodName) {
    throw new Error(`Unknown WidgetVA alias for MCP tool: ${alias}`)
  }
  const descriptor = PAGE_PORT_METHOD_DESCRIPTORS[methodName]
  if (!descriptor) {
    throw new Error(`Missing page-port descriptor for MCP tool: ${alias} -> ${methodName}`)
  }
  return {
    name: alias,
    title: titleFromToolName(alias),
    description: descriptor.description || `${alias} via WidgetVA page port.`,
    inputSchema: clone(descriptor.inputSchema || { type: 'object', properties: {} }),
  }
}

export const WIDGETVA_MCP_TOOLS = [
  ...TRANSPORT_PAGE_PORT_ALIASES,
].map(buildMcpTool)

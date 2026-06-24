import {
  describeWidgetAdapterCapabilitiesSchema,
  describeWidgetAdapterProviderCapabilitiesSchema,
} from './widgetAdapters.js'
import { describeDataHandleSchema } from './dataHandles.js'
import { describeWidgetLinkSchema } from './widgetLinks.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeWidgetRegistryCounts(counts) {
  return {
    widgetCount: 0,
    dataHandleCount: 0,
    linkCount: 0,
    adapterCount: 0,
    ...counts,
  }
}

export function describeWidgetRegistryCountsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      widgetCount: { type: 'integer' },
      dataHandleCount: { type: 'integer' },
      linkCount: { type: 'integer' },
      adapterCount: { type: 'integer' },
    },
  })
}

export function makeWidgetRegistryRefs(refs) {
  return {
    widgetRefs: [],
    dataRefs: [],
    linkRefs: [],
    ...refs,
  }
}

export function describeWidgetRegistryRefsSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      widgetRefs: { type: 'array', items: { type: 'string' } },
      dataRefs: { type: 'array', items: { type: 'string' } },
      linkRefs: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function makeWidgetRegistrySummary(summary) {
  return {
    widgets: [],
    dataHandles: [],
    links: [],
    ...summary,
    counts: makeWidgetRegistryCounts(summary?.counts),
    refs: makeWidgetRegistryRefs(summary?.refs),
  }
}

export function describeWidgetRegistryEntrySchema() {
  return cloneValue({
    type: 'object',
    required: ['ref', 'widgetId', 'kind', 'role'],
    properties: {
      ref: { type: 'string' },
      widgetId: { type: 'string' },
      kind: { type: 'string' },
      role: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      analyticRoles: { type: 'array', items: { type: 'string' } },
      sourceKind: { type: ['string', 'null'] },
      supportsSpecMutation: { type: 'boolean' },
      primaryDataRef: { type: ['string', 'null'] },
      sourceDataRef: { type: ['string', 'null'] },
      currentDataRef: { type: ['string', 'null'] },
      usageNotes: { type: 'array', items: { type: 'string' } },
      actionNames: { type: 'array', items: { type: 'string' } },
      perceptionQueryNames: { type: 'array', items: { type: 'string' } },
      adapterProvider: { type: ['string', 'null'] },
      providerCapabilities: {
        anyOf: [
          { type: 'null' },
          describeWidgetAdapterProviderCapabilitiesSchema(),
        ],
      },
      adapterCapabilities: {
        anyOf: [
          { type: 'null' },
          describeWidgetAdapterCapabilitiesSchema(),
        ],
      },
      humanInteractionMode: { type: ['string', 'null'] },
      humanInteractionActionName: { type: ['string', 'null'] },
      supportsDirectManipulation: { type: 'boolean' },
    },
  })
}

export function describeWidgetRegistrySummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['counts', 'refs', 'widgets', 'dataHandles', 'links'],
    properties: {
      counts: describeWidgetRegistryCountsSchema(),
      refs: describeWidgetRegistryRefsSchema(),
      widgets: {
        type: 'array',
        items: describeWidgetRegistryEntrySchema(),
      },
      dataHandles: {
        type: 'array',
        items: describeDataHandleSchema(),
      },
      links: {
        type: 'array',
        items: describeWidgetLinkSchema(),
      },
    },
  })
}

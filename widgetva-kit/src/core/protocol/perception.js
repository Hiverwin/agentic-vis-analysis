import { describeRuntimeActorSchema } from './actors.js'
import {
  describeDataGroupComparisonResultSchema,
  describeDataRowsResultSchema,
  describeDataSummaryTableSchema,
} from './dataHandles.js'
import {
  describeActionVerificationResultSchema,
} from './results.js'
import { describeQueryScopeSchema } from './queryScope.js'
import {
  describeFieldEncodingSchema,
  describeInteractionFeedbackStateSchema,
  describeSelectionStateSchema,
  describeTransformStateSchema,
  describeViewTransformStateSchema,
} from './state.js'

export const PERCEPTION_CATEGORIES = [
  'inspect',
  'summarize',
  'compute',
  'verify',
  'explain',
]

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function withOptionalQueryScope(paramsSchema) {
  if (!paramsSchema || typeof paramsSchema !== 'object' || Array.isArray(paramsSchema)) {
    return {
      type: 'object',
      properties: {
        queryScope: describeQueryScopeSchema(),
      },
    }
  }
  return {
    ...cloneValue(paramsSchema),
    properties: {
      ...(cloneValue(paramsSchema.properties) || {}),
      queryScope: describeQueryScopeSchema(),
    },
  }
}

export function describePerceptionCategorySchema() {
  return cloneValue({
    type: 'string',
    enum: PERCEPTION_CATEGORIES,
  })
}

export function describePerceptionInspectViewConfigResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      ref: { type: ['string', 'null'] },
      kind: { type: ['string', 'null'] },
      encodings: { type: 'object', additionalProperties: describeFieldEncodingSchema() },
      transforms: { type: 'array', items: describeTransformStateSchema() },
      view: describeViewTransformStateSchema(),
      selections: { type: 'object', additionalProperties: describeSelectionStateSchema() },
      feedback: {
        anyOf: [describeInteractionFeedbackStateSchema(), { type: 'null' }],
      },
    },
  })
}

export function describePerceptionInspectVisibleRowsResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      ref: { type: ['string', 'null'] },
      dataRef: { type: ['string', 'null'] },
      visibleCount: { type: 'integer' },
      rows: describeDataRowsResultSchema(),
    },
  })
}

export function describePerceptionSummaryGroupsSchema() {
  return cloneValue({
    type: 'array',
    items: describeDataSummaryTableSchema().properties.rows.items,
  })
}

export function describePerceptionSummarizeSelectionResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      hasSelection: { type: 'boolean' },
      selectionCount: { type: 'integer' },
      selectionRefs: { type: 'array', items: { type: 'string' } },
      dataRef: { type: ['string', 'null'] },
      selectedCount: { type: 'integer' },
      summary: { type: 'string' },
      selectionSummaries: { type: 'array', items: { type: 'string' } },
      groups: describePerceptionSummaryGroupsSchema(),
      aggregates: describePerceptionSummaryGroupsSchema(),
      predicates: { type: 'array', items: { type: 'object' } },
      selectionPredicates: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
}

export function describePerceptionSummarizeVisibleResultSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      rowCount: { type: 'integer' },
      groups: describePerceptionSummaryGroupsSchema(),
      aggregates: describePerceptionSummaryGroupsSchema(),
      summary: { type: ['string', 'null'] },
    },
  })
}

export function describePerceptionVerifyActionEffectParamsSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      actionName: { type: 'string' },
      stateId: { type: 'string' },
      refs: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function describePerceptionVerifyActionEffectResultSchema() {
  return describeActionVerificationResultSchema()
}

export const PERCEPTION_RETURN_SCHEMAS = {
  'perception.inspectViewConfig': describePerceptionInspectViewConfigResultSchema(),
  'perception.inspectVisibleRows': describePerceptionInspectVisibleRowsResultSchema(),
  'perception.summarizeSelection': describePerceptionSummarizeSelectionResultSchema(),
  'perception.summarizeVisible': describePerceptionSummarizeVisibleResultSchema(),
  'perception.verifyActionEffect': describePerceptionVerifyActionEffectResultSchema(),
  'perception.computeCorrelation': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      xField: { type: 'string' },
      yField: { type: 'string' },
      correlation: { type: ['number', 'null'] },
      sampleSize: { type: 'integer' },
    },
  },
  'perception.findExtremes': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      field: { type: ['string', 'null'] },
      direction: { type: 'string' },
      rows: describeDataRowsResultSchema(),
    },
  },
  'perception.findOutliers': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      field: { type: ['string', 'null'] },
      method: { type: 'string' },
      rows: describeDataRowsResultSchema(),
    },
  },
  'perception.compareGroups': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      groupField: { type: ['string', 'null'] },
      valueField: { type: ['string', 'null'] },
      groups: describeDataGroupComparisonResultSchema().properties.groups,
      comparison: describeDataGroupComparisonResultSchema().properties.comparison,
    },
  },
}

export function makePerceptionDescriptor(descriptor) {
  const returnsSchema = descriptor?.returnsSchema || (descriptor?.name ? PERCEPTION_RETURN_SCHEMAS[descriptor.name] : undefined)
  const baseParamsSchema =
    descriptor?.paramsSchema
    || (descriptor?.name === 'perception.verifyActionEffect' ? describePerceptionVerifyActionEffectParamsSchema() : undefined)
  const paramsSchema = withOptionalQueryScope(baseParamsSchema)
  return {
    ...descriptor,
    targetRef: descriptor?.targetRef ?? null,
    paramsSchema: paramsSchema || withOptionalQueryScope({
      type: 'object',
      properties: {},
    }),
    returnsSchema: returnsSchema || undefined,
    sideEffectFree: descriptor?.sideEffectFree !== false,
    evidenceKinds: Array.isArray(descriptor?.evidenceKinds) ? descriptor.evidenceKinds : [],
    verificationTargets: Array.isArray(descriptor?.verificationTargets) ? descriptor.verificationTargets : [],
    examples: Array.isArray(descriptor?.examples) ? descriptor.examples : [],
  }
}

export function describePerceptionExampleSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      userGoal: { type: 'string' },
      params: { type: 'object' },
    },
  })
}

export function describePerceptionDescriptorSchema() {
  return cloneValue({
    type: 'object',
    required: ['name', 'title', 'description', 'category'],
    properties: {
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      category: describePerceptionCategorySchema(),
      targetRef: { type: ['string', 'null'] },
      paramsSchema: { type: 'object' },
      returnsSchema: { type: ['object', 'null'] },
      sideEffectFree: { type: 'boolean' },
      evidenceKinds: { type: 'array', items: { type: 'string' } },
      verificationTargets: { type: 'array', items: { type: 'string' } },
      examples: { type: 'array', items: describePerceptionExampleSchema() },
    },
  })
}

export function describePerceptionQueryCallSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      callId: { type: 'string' },
      name: { type: 'string' },
      actor: describeRuntimeActorSchema(),
      queryScope: describeQueryScopeSchema(),
      params: { type: 'object' },
    },
  })
}

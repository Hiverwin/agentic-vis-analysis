import { describeActionCategorySchema, describeActionDescriptorSchema, describeActionExampleSchema, describeActionPrimitiveSchema } from './actions.js'
import { describeWidgetKindSchema } from './description.js'
import { describeFieldEncodingSchema } from './state.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function describeActionUsageFieldExplanationSchema() {
  return cloneValue({
    type: 'object',
    required: ['role', 'reason'],
    properties: {
      role: { type: 'string' },
      value: { type: ['string', 'null'] },
      reason: { type: 'string' },
    },
  })
}

export function describeActionUsageFieldRoleMapSchema() {
  return cloneValue({
    type: 'object',
    required: ['xField', 'yField', 'colorField', 'categoryField', 'measureField', 'subCategoryField'],
    properties: {
      xField: { type: ['string', 'null'] },
      yField: { type: ['string', 'null'] },
      colorField: { type: ['string', 'null'] },
      categoryField: { type: ['string', 'null'] },
      measureField: { type: ['string', 'null'] },
      subCategoryField: { type: ['string', 'null'] },
    },
  })
}

export function describeActionUsageFieldCandidatesSchema() {
  return cloneValue({
    type: 'object',
    required: ['xFields', 'yFields', 'categoryFields', 'measureFields', 'groupFields'],
    properties: {
      xFields: { type: 'array', items: { type: 'string' } },
      yFields: { type: 'array', items: { type: 'string' } },
      categoryFields: { type: 'array', items: { type: 'string' } },
      measureFields: { type: 'array', items: { type: 'string' } },
      groupFields: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function describeActionUsageFieldRolesSchema() {
  return cloneValue({
    type: 'object',
    required: ['resolved', 'candidates', 'explanations'],
    properties: {
      resolved: describeActionUsageFieldRoleMapSchema(),
      candidates: describeActionUsageFieldCandidatesSchema(),
      explanations: {
        type: 'array',
        items: describeActionUsageFieldExplanationSchema(),
      },
    },
  })
}

export function describeActionUsageParamRoleSchema() {
  return cloneValue({
    type: 'string',
    enum: ['structural', 'intent', 'optional'],
  })
}

export function describeActionUsageParamRolesSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: describeActionUsageParamRoleSchema(),
  })
}

export function describeActionUsageSpecContextSchema() {
  return cloneValue({
    type: 'object',
    required: ['hasCurrentSpec', 'dataSourceKind', 'runtimeRowCount', 'encodings'],
    properties: {
      hasCurrentSpec: { type: 'boolean' },
      dataSourceKind: { type: ['string', 'null'] },
      runtimeRowCount: { type: 'integer', minimum: 0 },
      encodings: {
        type: 'object',
        required: ['x', 'y', 'color', 'size', 'shape'],
        properties: {
          x: { anyOf: [describeFieldEncodingSchema(), { type: 'null' }] },
          y: { anyOf: [describeFieldEncodingSchema(), { type: 'null' }] },
          color: { anyOf: [describeFieldEncodingSchema(), { type: 'null' }] },
          size: { anyOf: [describeFieldEncodingSchema(), { type: 'null' }] },
          shape: { anyOf: [describeFieldEncodingSchema(), { type: 'null' }] },
        },
      },
    },
  })
}

export function describeActionUsageEntrySchema() {
  return cloneValue({
    type: 'object',
    required: [
      'name',
      'title',
      'description',
      'primitive',
      'category',
      'requiredParams',
      'paramRoles',
      'suggestedParams',
      'recommendedCall',
      'diagnostics',
    ],
    properties: {
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      primitive: describeActionPrimitiveSchema(),
      category: describeActionCategorySchema(),
      targetRef: { type: ['string', 'null'] },
      supportedWidgetKinds: {
        anyOf: [
          { type: 'null' },
          { type: 'array', items: describeWidgetKindSchema() },
        ],
      },
      requiredParams: { type: 'array', items: { type: 'string' } },
      paramRoles: describeActionUsageParamRolesSchema(),
      suggestedParams: { type: 'object' },
      recommendedCall: { type: 'object' },
      diagnostics: { type: 'array', items: { type: 'string' } },
      paramsSchema: { anyOf: [{ type: 'object' }, { type: 'null' }] },
      examples: {
        anyOf: [
          { type: 'null' },
          { type: 'array', items: describeActionExampleSchema() },
        ],
      },
      actionDescriptor: { anyOf: [describeActionDescriptorSchema(), { type: 'null' }] },
    },
  })
}

export function describeActionUsageSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['targetRef', 'widgetId', 'widgetKind', 'title', 'diagnostics', 'specContext', 'fieldRoles', 'actions'],
    properties: {
      targetRef: { type: ['string', 'null'] },
      widgetId: { type: ['string', 'null'] },
      widgetKind: { anyOf: [describeWidgetKindSchema(), { type: 'null' }] },
      title: { type: ['string', 'null'] },
      diagnostics: { type: 'array', items: { type: 'string' } },
      specContext: describeActionUsageSpecContextSchema(),
      fieldRoles: describeActionUsageFieldRolesSchema(),
      actions: {
        type: 'array',
        items: describeActionUsageEntrySchema(),
      },
    },
  })
}

export function describeActionUsageRequestSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      targetRef: { type: 'string' },
      widgetRef: { type: 'string' },
      widgetId: { type: 'string' },
      actionName: { type: 'string' },
      includeSchemas: { type: 'boolean' },
      includeExamples: { type: 'boolean' },
    },
  })
}

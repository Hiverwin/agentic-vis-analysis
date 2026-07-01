import { describeRuntimeActorSchema } from './actors.js'
import { describeQueryScopeSchema } from './queryScope.js'

export const ACTION_PRIMITIVES = [
  'filter',
  'sort',
  'aggregate',
  'reencode',
  'zoom',
  'select',
  'highlight',
  'navigate',
  'compare',
  'annotate',
  'reset',
  'undo',
  'redo',
]

export const ACTION_CATEGORIES = [
  'dataTransform',
  'visualMapping',
  'viewTransform',
  'selection',
  'annotation',
  'navigation',
  'coordination',
]

export const ACTION_EFFECT_KINDS = [
  'updatesSelection',
  'filtersWidget',
  'updatesViewDomain',
  'changesEncoding',
  'highlightsItems',
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

export function describeActionPrimitiveSchema() {
  return cloneValue({
    type: 'string',
    enum: ACTION_PRIMITIVES,
  })
}

export function describeActionCategorySchema() {
  return cloneValue({
    type: 'string',
    enum: ACTION_CATEGORIES,
  })
}

export function makeActionDescriptor(descriptor) {
  const paramsSchema = withOptionalQueryScope(descriptor?.paramsSchema)
  return {
    scope: 'local',
    supportedWidgetKinds: null,
    affectedRefs: [],
    affectedStatePaths: [],
    effects: [],
    reversible: false,
    preconditions: [],
    postconditions: [],
    examples: [],
    ...descriptor,
    paramsSchema,
  }
}

export function describeActionEffectSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ACTION_EFFECT_KINDS },
      ref: { type: ['string', 'null'] },
      description: { type: 'string' },
    },
  })
}

export function describeActionEffectKindSchema() {
  return cloneValue({
    type: 'string',
    enum: ACTION_EFFECT_KINDS,
  })
}

export function describeActionConditionSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      description: { type: 'string' },
      checkHint: { type: 'string' },
      failureMessage: { type: 'string' },
    },
  })
}

export function describeActionExampleSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      userGoal: { type: 'string' },
      params: { type: 'object' },
    },
  })
}

export function describeActionDescriptorSchema() {
  return cloneValue({
    type: 'object',
    required: ['name', 'title', 'description', 'primitive', 'category'],
    properties: {
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      primitive: describeActionPrimitiveSchema(),
      category: describeActionCategorySchema(),
      scope: { type: 'string' },
      supportedWidgetKinds: {
        anyOf: [
          { type: 'null' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      targetRef: { type: ['string', 'null'] },
      affectedRefs: { type: 'array', items: { type: 'string' } },
      affectedStatePaths: { type: 'array', items: { type: 'string' } },
      analyticalPlacement: { type: ['string', 'null'] },
      sharedAnalyticalSurface: { type: ['string', 'null'] },
      paramsSchema: { type: 'object' },
      reversible: { type: 'boolean' },
      preconditions: { type: 'array', items: describeActionConditionSchema() },
      postconditions: { type: 'array', items: describeActionConditionSchema() },
      effects: { type: 'array', items: describeActionEffectSchema() },
      examples: { type: 'array', items: describeActionExampleSchema() },
    },
  })
}

export function describeActionCallSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    required: ['name', 'params'],
    properties: {
      callId: { type: 'string' },
      name: { type: 'string' },
      actor: describeRuntimeActorSchema(),
      reason: { type: 'string' },
      queryScope: describeQueryScopeSchema(),
      params: { type: 'object' },
    },
  })
}

export function makeSelectionEffect(ref, description) {
  return {
    kind: 'updatesSelection',
    ref,
    description,
  }
}

export function makeFilterEffect(ref, description) {
  return {
    kind: 'filtersWidget',
    ref,
    description,
  }
}

export function makeDomainEffect(ref, description) {
  return {
    kind: 'updatesViewDomain',
    ref,
    description,
  }
}

export function makeEncodingEffect(ref, description) {
  return {
    kind: 'changesEncoding',
    ref,
    description,
  }
}

export function makeHighlightEffect(ref, description) {
  return {
    kind: 'highlightsItems',
    ref,
    description,
  }
}

import { cloneJsonValue as cloneValue } from '../shared/clone.js'
import { QUERY_SCOPE_SCHEMA } from '../schemas/query-scope.schema.js'
import {
  readPerceptionParamsSchema,
  readPerceptionReturnsSchema,
} from '../schemas/perception.schema.js'

function withPerceptionQueryScope(paramsSchema) {
  if (!paramsSchema || typeof paramsSchema !== 'object' || Array.isArray(paramsSchema)) {
    return {
      type: 'object',
      properties: {
        queryScope: QUERY_SCOPE_SCHEMA,
      },
    }
  }
  return {
    ...cloneValue(paramsSchema),
    properties: {
      ...(cloneValue(paramsSchema.properties) || {}),
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  }
}

export function makePerceptionDescriptor(descriptor) {
  const returnsSchema = descriptor?.returnsSchema || readPerceptionReturnsSchema(descriptor?.name)
  const baseParamsSchema =
    descriptor?.paramsSchema
    || readPerceptionParamsSchema(descriptor?.name)
  const paramsSchema = withPerceptionQueryScope(baseParamsSchema)
  return {
    ...descriptor,
    targetRef: descriptor?.targetRef ?? null,
    paramsSchema: paramsSchema || withPerceptionQueryScope({
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

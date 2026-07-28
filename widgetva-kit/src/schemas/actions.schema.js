import { RUNTIME_ACTOR_SCHEMA } from './actors.schema.js'
import { QUERY_SCOPE_SCHEMA } from './query-scope.schema.js'

const ACTION_TARGET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['widgetRef'],
  properties: {
    widgetRef: { type: 'string' },
  },
}

export const ACTION_CALL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'params'],
  properties: {
    callId: { type: 'string' },
    name: { type: 'string' },
    actor: RUNTIME_ACTOR_SCHEMA,
    reason: { type: 'string' },
    target: ACTION_TARGET_SCHEMA,
    queryScope: QUERY_SCOPE_SCHEMA,
    params: { type: 'object' },
  },
}

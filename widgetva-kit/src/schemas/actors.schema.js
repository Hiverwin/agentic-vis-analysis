export const RUNTIME_ACTORS = ['agent', 'human', 'system']

export const RUNTIME_ACTOR_SCHEMA = {
  type: 'string',
  enum: RUNTIME_ACTORS,
}

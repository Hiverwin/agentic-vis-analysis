function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeCoordinationRelation(relation = {}) {
  const ref = relation?.ref || relation?.id || null
  return {
    ref,
    sourceStateRef: typeof relation?.sourceStateRef === 'string' ? relation.sourceStateRef : null,
    targetStateRef: typeof relation?.targetStateRef === 'string' ? relation.targetStateRef : null,
    relation: relation?.relation || 'controls',
    transform: relation?.transform && typeof relation.transform === 'object' && !Array.isArray(relation.transform)
      ? cloneValue(relation.transform)
      : null,
    activation: relation?.activation || relation?.activationPolicy || 'automatic',
  }
}

export function makeCoordinationRelationMap(relations = {}) {
  if (Array.isArray(relations)) {
    return Object.fromEntries(
      relations
        .map((relation) => makeCoordinationRelation(relation))
        .filter((relation) => relation.ref && relation.sourceStateRef && relation.targetStateRef)
        .map((relation) => [relation.ref, relation]),
    )
  }

  if (!relations || typeof relations !== 'object') return {}

  return Object.fromEntries(
    Object.entries(relations)
      .map(([ref, relation]) => {
        const normalizedRelation = makeCoordinationRelation({ ...(relation || {}), ref })
        return [normalizedRelation.ref, normalizedRelation]
      })
      .filter(([, relation]) => relation.ref && relation.sourceStateRef && relation.targetStateRef),
  )
}

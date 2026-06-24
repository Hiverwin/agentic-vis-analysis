function buildActorToken(segment) {
  if (segment?.dominantActor === 'human') {
    return {
      key: 'actor',
      label: 'H',
      title: 'Human-led segment',
      kind: 'actor-human',
    }
  }

  if (segment?.dominantActor === 'agent') {
    return {
      key: 'actor',
      label: 'A',
      title: 'Agent-led segment',
      kind: 'actor-agent',
    }
  }

  return {
    key: 'actor',
    label: 'M',
    title: 'Mixed human-agent segment',
    kind: 'actor-mixed',
  }
}

export function buildTraceSegmentSummary(segment = {}) {
  const tokens = [buildActorToken(segment)]

  if (segment?.branchEntry) {
    tokens.push({
      key: 'branch-entry',
      label: 'BR',
      title: 'Branch-entry segment',
      kind: 'branch-entry',
    })
  }

  if (segment?.hasHandoff) {
    tokens.push({
      key: 'handoff',
      label: 'HF',
      title: 'Contains human-agent handoff',
      kind: 'handoff',
    })
  }

  if (segment?.hasStateDelta) {
    tokens.push({
      key: 'state',
      label: 'ST',
      title: 'Contains shared state change',
      kind: 'state',
    })
  }

  if (segment?.hasEvidence) {
    tokens.push({
      key: 'evidence',
      label: 'EV',
      title: 'Contains evidence or verification output',
      kind: 'evidence',
    })
  }

  const descriptors = []
  if (segment?.branchEntry) descriptors.push('branch entry')
  if (segment?.hasHandoff) descriptors.push('handoff')
  if (segment?.hasStateDelta) descriptors.push('state change')
  if (segment?.hasEvidence) descriptors.push('evidence')

  return {
    actorToken: tokens[0],
    semanticTokens: tokens.slice(1),
    descriptor: descriptors.join(', ') || 'continuation',
  }
}

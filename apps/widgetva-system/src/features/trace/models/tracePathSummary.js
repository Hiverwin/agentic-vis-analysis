export function buildTracePathSummary(pathSummary = {}) {
  const tokens = []

  if (pathSummary?.dominantActor === 'human') {
    tokens.push({ key: 'actor', label: 'H', kind: 'actor-human', title: 'Human-led path' })
  } else if (pathSummary?.dominantActor === 'agent') {
    tokens.push({ key: 'actor', label: 'A', kind: 'actor-agent', title: 'Agent-led path' })
  } else {
    tokens.push({ key: 'actor', label: 'M', kind: 'actor-mixed', title: 'Mixed human-agent path' })
  }

  if (pathSummary?.hasBranchEntry) {
    tokens.push({ key: 'branch-entry', label: 'BR', kind: 'branch-entry', title: 'Branch path' })
  }
  if (pathSummary?.hasHandoff) {
    tokens.push({ key: 'handoff', label: 'HF', kind: 'handoff', title: 'Contains handoff' })
  }
  if (pathSummary?.hasStateDelta) {
    tokens.push({ key: 'state', label: 'ST', kind: 'state', title: 'Contains state change' })
  }
  if (pathSummary?.hasEvidence) {
    tokens.push({ key: 'evidence', label: 'EV', kind: 'evidence', title: 'Contains evidence' })
  }

  return {
    tokens,
    descriptor: pathSummary?.shortSummary || '',
  }
}

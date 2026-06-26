function buildPathGroupKey(entry) {
  if (entry?.pathContext?.pathId) return `path:${entry.pathContext.pathId}`
  if (entry?.branchId) return `branch:${entry.branchId}`
  return 'ungrouped'
}

function readPathGroupId(entry) {
  if (entry?.pathContext?.pathId) return entry.pathContext.pathId
  return null
}

function buildPathGroupLabel(entry) {
  if (entry?.pathContext?.pathLabel) return `Path ${entry.pathContext.pathLabel}`
  if (entry?.branchNarrative?.branchLabel) return entry.branchNarrative.branchLabel
  if (entry?.branchId && entry.branchId !== 'main') return `Branch ${entry.branchId}`
  return 'Main / Unscoped'
}

function buildPathGroupSummary(entry, entries) {
  if (entry?.pathContext?.pathSummary) return entry.pathContext.pathSummary
  return `${entries.length} finding${entries.length === 1 ? '' : 's'}`
}

function buildPathGroupComparisonSummary(entries = []) {
  const safeEntries = Array.isArray(entries) ? entries : []
  const findingCount = safeEntries.length
  const traceLinkedCount = safeEntries.filter((entry) => Boolean(entry?.traceStepId)).length
  const forkedCount = safeEntries.filter((entry) => Boolean(entry?.branchNarrative)).length
  const distinctWidgets = new Set(safeEntries.map((entry) => entry?.widgetId).filter(Boolean)).size

  return [
    `${findingCount} finding${findingCount === 1 ? '' : 's'}`,
    traceLinkedCount > 0 ? `${traceLinkedCount} trace-linked` : null,
    forkedCount > 0 ? `${forkedCount} fork-aware` : null,
    distinctWidgets > 1 ? `${distinctWidgets} widgets` : null,
  ].filter(Boolean).join(' · ')
}

function annotateCrossPathComparison(groups = []) {
  const safeGroups = Array.isArray(groups) ? groups : []
  const maxFindings = safeGroups.reduce((max, group) => Math.max(max, group.entries.length), 0)
  const maxForkAware = safeGroups.reduce(
    (max, group) => Math.max(max, group.entries.filter((entry) => Boolean(entry?.branchNarrative)).length),
    0,
  )

  return safeGroups.map((group) => {
    const forkAwareCount = group.entries.filter((entry) => Boolean(entry?.branchNarrative)).length
    const badges = []
    if (group.entries.length > 0 && group.entries.length === maxFindings && maxFindings > 1) {
      badges.push('most findings')
    }
    if (forkAwareCount > 0 && forkAwareCount === maxForkAware && maxForkAware > 0) {
      badges.push('most fork-aware')
    }
    return {
      ...group,
      comparisonBadges: badges,
    }
  })
}

export function groupFindingsByPath(findings = []) {
  const safeFindings = Array.isArray(findings) ? findings : []
  const groups = []
  const groupMap = new Map()

  for (const entry of safeFindings) {
    const key = buildPathGroupKey(entry)
    if (!groupMap.has(key)) {
      const group = {
        key,
        pathId: readPathGroupId(entry),
        label: buildPathGroupLabel(entry),
        summary: '',
        comparisonSummary: '',
        entries: [],
      }
      groupMap.set(key, group)
      groups.push(group)
    }
    groupMap.get(key).entries.push(entry)
  }

  for (const group of groups) {
    group.summary = buildPathGroupSummary(group.entries[0], group.entries)
    group.comparisonSummary = buildPathGroupComparisonSummary(group.entries)
  }

  return annotateCrossPathComparison(groups)
}

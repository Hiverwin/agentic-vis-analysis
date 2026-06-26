export function summarizeSelection(selection) {
  if (!selection) return 'No active selection'
  const clauses = Array.isArray(selection.clauses) ? selection.clauses.join(' · ') : []
  return `${selection.label} · ${selection.count} records${clauses.length ? ` · ${clauses}` : ''}`
}

export function buildEvidenceEntry(entry, index) {
  return {
    id: entry.id || `evidence_${index}`,
    title: entry.title,
    note: entry.note,
    widgetId: entry.widgetId,
    confidence: entry.confidence || 'working',
    provenance: entry.provenance || 'manual',
    traceStepId: entry.traceStepId || null,
    stateId: entry.stateId || null,
    branchId: entry.branchId || null,
    branchNarrative: entry.branchNarrative
      ? {
          branchLabel: entry.branchNarrative.branchLabel || null,
          forkDescription: entry.branchNarrative.forkDescription || null,
          entryStepLabel: entry.branchNarrative.entryStepLabel || null,
          originStepId: entry.branchNarrative.originStepId || null,
          entryStepId: entry.branchNarrative.entryStepId || null,
        }
      : null,
    pathContext: entry.pathContext
      ? {
          pathId: entry.pathContext.pathId || null,
          pathLabel: entry.pathContext.pathLabel || null,
          pathSummary: entry.pathContext.pathSummary || null,
          segmentCount: entry.pathContext.segmentCount || 0,
          stepCount: entry.pathContext.stepCount || 0,
        }
      : null,
  }
}

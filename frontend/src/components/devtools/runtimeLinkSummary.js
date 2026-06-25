function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

export function summarizeRuntimeWidgetLink(link) {
  if (!link || typeof link !== 'object') return null

  const fieldMappings = Array.isArray(link.fieldMapping)
    ? link.fieldMapping
        .filter((mapping) => mapping?.sourceField && mapping?.targetField)
        .map((mapping) => `${mapping.sourceField}->${mapping.targetField}`)
    : []

  return {
    ref: normalizeString(link.ref) || null,
    kind: normalizeString(link.primitive) || normalizeString(link.kind) || 'link',
    source: normalizeString(link.sourceWidgetId) || normalizeString(link.from) || '-',
    target: normalizeString(link.targetWidgetId) || normalizeString(link.to) || '-',
    trigger: normalizeString(link.trigger) || null,
    effect: normalizeString(link.effect) || null,
    propagationPolicy: normalizeString(link.propagationPolicy) || 'automatic',
    automatic: link.automatic !== false,
    fieldMappings,
    description: normalizeString(link.description) || null,
  }
}

export function summarizeRuntimeLinkMap({ workspace, engine } = {}) {
  const links = Array.isArray(workspace?.links) ? workspace.links : []
  const primitives = Array.isArray(engine?.primitives) ? engine.primitives : []
  const topology = engine?.topology || null

  return {
    linkCount: links.length,
    primitiveNames: primitives.map((item) => normalizeString(item?.name) || normalizeString(item)).filter(Boolean),
    topology,
    coordinationLinkCount: Number.isFinite(engine?.coordinationLinkCount) ? engine.coordinationLinkCount : null,
    structuralLinkCount: Number.isFinite(engine?.structuralLinkCount) ? engine.structuralLinkCount : null,
    automaticLinkCount: Number.isFinite(engine?.automaticLinkCount) ? engine.automaticLinkCount : null,
    manualLinkCount: Number.isFinite(engine?.manualLinkCount) ? engine.manualLinkCount : null,
    links: links.map((link) => summarizeRuntimeWidgetLink(link)).filter(Boolean),
  }
}

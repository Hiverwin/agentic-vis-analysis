import { cloneJsonValue as clone } from '../../shared/clone.js'
import {
  collectWidgetKindCandidates,
  detectVisualizationProvider,
  inferWidgetKindFromEChartsOption,
  inferWidgetKindFromVegaLiteSpec,
  parseVisualizationArtifactScript,
  readExplicitWidgetKindHint,
  resolveImportedEChartsOption,
  resolveImportedTitle,
  resolveImportedVegaLiteSpec,
  resolveVgplotArtifact,
} from './visualizationArtifactInference.js'

export {
  detectVisualizationProvider,
  inferWidgetKindFromEChartsOption,
  inferWidgetKindFromVegaLiteSpec,
  inferWidgetKindFromVgplotScript,
  parseVisualizationArtifactScript,
  resolveVgplotArtifact,
} from './visualizationArtifactInference.js'

function inferTypeFromKind(widgetKind, provider = 'vega-lite') {
  if (provider === 'vega-lite' || provider === 'vega') {
    if (widgetKind === 'scatter') return 'scatter-vega'
    if (widgetKind === 'bar') return 'bar-vega'
    if (widgetKind === 'line') return 'line-vega'
    if (widgetKind === 'heatmap') return 'heatmap-vega'
    if (widgetKind === 'parallelCoordinates') return 'parallel-vega'
    if (widgetKind === 'sankey') return 'sankey-vega'
    return null
  }
  if (provider === 'echarts') {
    if (widgetKind === 'scatter') return 'scatter-echarts'
    if (widgetKind === 'bar') return 'bar-echarts'
    if (widgetKind === 'line') return 'line-echarts'
    if (widgetKind === 'heatmap') return 'heatmap-echarts'
    if (widgetKind === 'parallelCoordinates') return 'parallel-echarts'
    if (widgetKind === 'sankey') return 'sankey-echarts'
    return null
  }
  if (provider === 'vgplot') {
    if (widgetKind === 'scatter') return 'scatter-vgplot'
    if (widgetKind === 'bar') return 'bar-vgplot'
    if (widgetKind === 'line') return 'line-vgplot'
    if (widgetKind === 'heatmap') return 'heatmap-vgplot'
    if (widgetKind === 'parallelCoordinates') return 'parallel-vgplot'
    if (widgetKind === 'sankey') return 'sankey-vgplot'
    return null
  }
  return null
}

function inferFieldCount(rows = []) {
  const fieldNames = new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    Object.keys(row).forEach((fieldName) => fieldNames.add(fieldName))
  }
  return fieldNames.size
}

function resolveInlineValues(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return []

  if (Array.isArray(spec?.data?.values)) {
    return clone(spec.data.values)
  }

  const namedDataset = typeof spec?.data?.name === 'string' && spec.data.name.length > 0
    ? spec?.datasets?.[spec.data.name]
    : null
  if (Array.isArray(namedDataset)) {
    return clone(namedDataset)
  }

  if (Array.isArray(spec.layer) && spec.layer.length === 1) {
    const layerSpec = spec.layer[0]
    if (Array.isArray(layerSpec?.data?.values)) {
      return clone(layerSpec.data.values)
    }
    const layerNamedDataset = typeof layerSpec?.data?.name === 'string' && layerSpec.data.name.length > 0
      ? spec?.datasets?.[layerSpec.data.name]
      : null
    if (Array.isArray(layerNamedDataset)) {
      return clone(layerNamedDataset)
    }
  }

  return []
}

function buildImportedDataset(title = 'Imported visualization', spec = {}) {
  const rowsData = resolveInlineValues(spec)
  const fieldCount = inferFieldCount(rowsData)
  const hasInlineRows = rowsData.length > 0
  return {
    name: title,
    rows: rowsData.length,
    fields: fieldCount,
    coverage: hasInlineRows
      ? 'Inline data embedded in imported Vega-Lite specification'
      : 'Imported Vega-Lite specification',
    rowsData,
  }
}

function buildImportedEChartsDataset(title = 'Imported visualization') {
  return {
    name: title,
    rows: 0,
    fields: 0,
    coverage: 'Imported ECharts option',
    rowsData: [],
  }
}

function buildImportedVgplotDataset(title = 'Imported visualization') {
  return {
    name: title,
    rows: 0,
    fields: 0,
    coverage: 'Imported vgplot script',
    rowsData: [],
  }
}

function readDeclaredCoordinationLinks(artifactObject = {}) {
  const declaredLinks = Array.isArray(artifactObject?.coordinationLinks)
    ? artifactObject.coordinationLinks
    : Array.isArray(artifactObject?.links)
      ? artifactObject.links
      : []
  return declaredLinks
    .filter((link) => link && typeof link === 'object' && !Array.isArray(link))
    .map((link) => clone(link))
}

function buildImportedWidgetDefinition({
  widgetId = 'w_imported_primary',
  title = 'Imported visualization',
  widgetKind = 'custom',
  recognizedKinds = [],
  provider = 'vega-lite',
  sourceType = 'importedSpec',
  source = {},
} = {}) {
  const normalizedRecognizedKinds = [...new Set((Array.isArray(recognizedKinds) ? recognizedKinds : []).filter(Boolean))]
  return {
    id: widgetId,
    title,
    subtitle: 'Imported chart',
    type: inferTypeFromKind(widgetKind, provider),
    widgetKind,
    provider,
    role: 'primary',
    sourceType,
    insight: 'Imported visualization.',
    metrics: [],
    encodings: [],
    recognizedKinds: normalizedRecognizedKinds,
    source,
  }
}

function buildImportedSource({
  provider,
  widgetKind,
  spec = null,
  option = null,
  scriptText = '',
} = {}) {
  if (provider === 'vgplot') {
    return {
      kind: 'nativeArtifact',
      provider: 'vgplot',
      providerSpec: {
        provider: 'vgplot',
        artifactType: 'script',
        scriptText,
      },
    }
  }

  if (provider === 'echarts') {
    return {
      kind: 'nativeArtifact',
      provider,
      option,
      providerSpec: {
        provider,
        optionType: widgetKind,
        option: clone(option),
      },
    }
  }

  return {
    kind: 'templateSpec',
    provider,
    spec,
    providerSpec: {
      provider,
      specType: widgetKind,
      spec: clone(spec),
    },
  }
}

export function buildVisualizationPreview({
  scriptText = '',
  preferredProvider = 'vega-lite',
} = {}) {
  const artifact = parseVisualizationArtifactScript(scriptText)
  const artifactObject = artifact && typeof artifact === 'object' && !Array.isArray(artifact) ? artifact : null
  if (Array.isArray(artifactObject?.widgets)) {
    throw new Error('Multi-widget workspace load is not implemented yet for this host flow.')
  }

  const provider = detectVisualizationProvider(artifact, {
    fallbackProvider: preferredProvider,
    sourceText: scriptText,
  })

  if (provider === 'vgplot') {
    const descriptor = resolveVgplotArtifact(artifact, scriptText)
    const title = descriptor.title || 'Imported vgplot visualization'
    const widgetKind = descriptor.widgetKind || 'custom'
    return {
      title,
      provider: 'vgplot',
      widgetKind,
      widget: buildImportedWidgetDefinition({
        widgetId: 'w_loaded_preview',
        title,
        widgetKind,
        provider: 'vgplot',
        sourceType: 'loadedPreview',
        source: buildImportedSource({
          provider: 'vgplot',
          widgetKind,
          scriptText,
        }),
      }),
    }
  }

  if (!artifactObject) {
    throw new Error('Visualization script must evaluate to an object.')
  }

  const title = resolveImportedTitle(artifactObject, 'Imported visualization')
  const coordinationLinks = readDeclaredCoordinationLinks(artifactObject)

  if (provider === 'echarts') {
    const option = resolveImportedEChartsOption(artifactObject)
    const widgetKind = typeof artifactObject.widgetKind === 'string' && artifactObject.widgetKind.length > 0
      ? artifactObject.widgetKind
      : inferWidgetKindFromEChartsOption(option)

    return {
      title,
      provider,
      widgetKind,
      widget: buildImportedWidgetDefinition({
        widgetId: 'w_loaded_preview',
        title,
        widgetKind,
        provider,
        sourceType: 'loadedPreview',
        source: buildImportedSource({
          provider,
          widgetKind,
          option,
        }),
      }),
    }
  }

  const spec = resolveImportedVegaLiteSpec(artifactObject)
  const widgetKind = typeof artifactObject.widgetKind === 'string' && artifactObject.widgetKind.length > 0
    ? artifactObject.widgetKind
    : inferWidgetKindFromVegaLiteSpec(spec)
  const explicitKind = readExplicitWidgetKindHint(spec)
  const recognizedKinds = explicitKind
    ? [widgetKind]
    : [...collectWidgetKindCandidates(spec)]

  return {
    title,
    provider,
    widgetKind,
    widget: buildImportedWidgetDefinition({
        widgetId: 'w_loaded_preview',
        title,
        widgetKind,
        recognizedKinds,
        provider,
        sourceType: 'loadedPreview',
        source: buildImportedSource({
          provider,
          widgetKind,
          recognizedKinds,
          spec,
        }),
    }),
  }
}

export function buildImportedVisualizationCase({
  scriptText = '',
  caseId = `imported_spec_${Date.now()}`,
  widgetId = 'w_imported_primary',
  preferredProvider = 'vega-lite',
} = {}) {
  const artifact = parseVisualizationArtifactScript(scriptText)
  const artifactObject = artifact && typeof artifact === 'object' && !Array.isArray(artifact) ? artifact : null
  if (Array.isArray(artifactObject?.widgets)) {
    throw new Error('Multi-widget workspace load is not implemented yet for this host flow.')
  }

  const provider = detectVisualizationProvider(artifact, {
    fallbackProvider: preferredProvider,
    sourceText: scriptText,
  })
  if (provider === 'vgplot') {
    const descriptor = resolveVgplotArtifact(artifact, scriptText)
    const title = descriptor.title || 'Imported vgplot visualization'
    const widgetKind = descriptor.widgetKind || 'custom'
    const coordinationLinks = readDeclaredCoordinationLinks(artifactObject || {})

    return {
      id: caseId,
      sourceType: 'importedSpec',
      title,
      summary: 'User-loaded visualization mounted into the current host VA.',
      topology: 'single-view',
      workspaceProviderEnvironment: 'vgplot',
      dataset: buildImportedVgplotDataset(title),
      coordinationLinks,
      widgets: [
        buildImportedWidgetDefinition({
          widgetId,
          title,
          widgetKind,
          provider: 'vgplot',
          sourceType: 'importedSpec',
          source: buildImportedSource({
            provider: 'vgplot',
            widgetKind,
            scriptText,
          }),
        }),
      ],
      findings: [],
      trace: [],
      agentChat: [],
      replaySteps: [],
      branches: [],
      log: [],
    }
  }

  if (!artifactObject) {
    throw new Error('Visualization script must evaluate to an object.')
  }

  const title = resolveImportedTitle(artifactObject, 'Imported visualization')
  const coordinationLinks = readDeclaredCoordinationLinks(artifactObject)

  if (provider === 'echarts') {
    const option = resolveImportedEChartsOption(artifactObject)
    const widgetKind = typeof artifactObject.widgetKind === 'string' && artifactObject.widgetKind.length > 0
      ? artifactObject.widgetKind
      : inferWidgetKindFromEChartsOption(option)

    return {
      id: caseId,
      sourceType: 'importedSpec',
      title,
      summary: 'User-loaded visualization mounted into the current host VA.',
      topology: 'single-view',
      workspaceProviderEnvironment: provider,
      dataset: buildImportedEChartsDataset(title),
      coordinationLinks,
      widgets: [
        buildImportedWidgetDefinition({
          widgetId,
          title,
          widgetKind,
          provider,
          sourceType: 'importedSpec',
          source: buildImportedSource({
            provider,
            widgetKind,
            option,
          }),
        }),
      ],
      findings: [],
      trace: [],
      agentChat: [],
      replaySteps: [],
      branches: [],
      log: [],
    }
  }

  const spec = resolveImportedVegaLiteSpec(artifactObject)
  const widgetKind = typeof artifactObject.widgetKind === 'string' && artifactObject.widgetKind.length > 0
    ? artifactObject.widgetKind
    : inferWidgetKindFromVegaLiteSpec(spec)
  const explicitKind = readExplicitWidgetKindHint(spec)
  const recognizedKinds = explicitKind
    ? [widgetKind]
    : [...collectWidgetKindCandidates(spec)]

  return {
    id: caseId,
    sourceType: 'importedSpec',
    title,
    summary: 'User-loaded visualization mounted into the current host VA.',
    topology: 'single-view',
    workspaceProviderEnvironment: provider,
    dataset: buildImportedDataset(title, spec),
    coordinationLinks,
    widgets: [
      buildImportedWidgetDefinition({
        widgetId,
        title,
        widgetKind,
        recognizedKinds,
        provider,
        sourceType: 'importedSpec',
          source: buildImportedSource({
            provider,
            widgetKind,
            recognizedKinds,
            spec,
          }),
      }),
    ],
    findings: [],
    trace: [],
    agentChat: [],
    replaySteps: [],
    branches: [],
    log: [],
  }
}

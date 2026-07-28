import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

const ADAPTERS_DIR = new URL('.', import.meta.url)
const SRC_DIR = new URL('../', import.meta.url)

function listJavaScriptFiles(dirUrl) {
  const files = []
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    const entryUrl = new URL(entry.name, dirUrl)
    if (entry.isDirectory()) {
      files.push(...listJavaScriptFiles(new URL(`${entry.name}/`, dirUrl)))
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(entryUrl)
    }
  }
  return files
}

test('adapters do not keep the mixed familyAdapters layer', () => {
  const familyAdaptersDir = new URL('familyAdapters/', ADAPTERS_DIR)
  const offenders = listJavaScriptFiles(SRC_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      return source.includes('familyAdapters')
        ? relative(SRC_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.equal(existsSync(familyAdaptersDir), false)
  assert.deepEqual(offenders, [])
})

test('adapters do not keep thin compatibility wrappers with misleading ownership', () => {
  const removedWrappers = [
    'WidgetAdapter.js',
    'vegaSpecAdapter.js',
    'runtimeWidgetAdapters.js',
    'custom/families/defaultWidgetAdapter.js',
  ]

  for (const wrapper of removedWrappers) {
    assert.equal(existsSync(new URL(wrapper, ADAPTERS_DIR)), false)
  }

  const offenders = listJavaScriptFiles(SRC_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      const importsRemovedWrapper = [
        /from\s+['"][^'"]*adapters\/WidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*adapters\/vegaSpecAdapter\.js['"]/,
        /from\s+['"][^'"]*adapters\/runtimeWidgetAdapters\.js['"]/,
        /from\s+['"][^'"]*adapters\/custom\/families\/defaultWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\/WidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\/vegaSpecAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\/runtimeWidgetAdapters\.js['"]/,
        /from\s+['"][^'"]*\.\/custom\/families\/defaultWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\.\/WidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\.\/vegaSpecAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\.\/runtimeWidgetAdapters\.js['"]/,
        /from\s+['"][^'"]*\.\.\/custom\/families\/defaultWidgetAdapter\.js['"]/,
      ].some((pattern) => pattern.test(source))
      return importsRemovedWrapper
        ? relative(SRC_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.deepEqual(offenders, [])
})

test('provider family behavior is owned by provider-specific modules', () => {
  const removedMixedModules = [
    'providerFamilyBehavior.js',
  ]

  for (const modulePath of removedMixedModules) {
    assert.equal(existsSync(new URL(modulePath, ADAPTERS_DIR)), false)
  }

  const expectedProviderModules = [
    'shared/providerStatePayloads.js',
    'd3/d3FamilyBehavior.js',
    'echarts/echartsFamilyBehavior.js',
  ]
  for (const modulePath of expectedProviderModules) {
    assert.equal(existsSync(new URL(modulePath, ADAPTERS_DIR)), true)
  }

  const offenders = listJavaScriptFiles(SRC_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      const importsMixedModule = [
        /from\s+['"][^'"]*adapters\/providerFamilyBehavior\.js['"]/,
        /from\s+['"][^'"]*\.\/providerFamilyBehavior\.js['"]/,
        /from\s+['"][^'"]*\.\.\/providerFamilyBehavior\.js['"]/,
      ].some((pattern) => pattern.test(source))
      return importsMixedModule
        ? relative(SRC_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.deepEqual(offenders, [])
})

test('adapters do not depend on widget-family shared implementation helpers', () => {
  const offenders = listJavaScriptFiles(ADAPTERS_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      return /from\s+['"][^'"]*widgets\/families\/shared\//.test(source)
        ? relative(ADAPTERS_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.deepEqual(offenders, [])
})

test('adapters do not own widget-family descriptors or runtime handler registration', () => {
  const offenders = listJavaScriptFiles(ADAPTERS_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      const ownsSemanticSurface = [
        /from\s+['"][^'"]*widgets\/families\//,
        /from\s+['"][^'"]*core\/runtime\/actions\//,
        /\bbuildActionDescriptors\s*\(/,
        /\bbuildPerceptionDescriptors\s*\(/,
        /\bregisterActions\s*\(/,
        /\bregisterPerceptionQueries\s*\(/,
      ].some((pattern) => pattern.test(source))
      return ownsSemanticSurface
        ? relative(ADAPTERS_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.deepEqual(offenders, [])
})

test('adapter public barrel does not expose vgplot internals', () => {
  const source = readFileSync(new URL('index.js', ADAPTERS_DIR), 'utf8')
  const internalVgplotExports = [
    'VgplotWidgetAdapter.js',
    'vgplotOrchestration.js',
    'vgplotCapabilityResolver.js',
    'vgplotActionRouter.js',
    'vgplotPerceptionQueries.js',
    'vgplotState.js',
    'vgplotVerification.js',
    'vgplotRuntimeCapture.js',
    'vgplotRuntimeRegistry.js',
  ]

  for (const modulePath of internalVgplotExports) {
    assert.equal(source.includes(modulePath), false)
  }
})

test('adapters do not keep the legacy custom chart wrapper path', () => {
  const removedCustomWrapperModules = [
    'custom/chartWrapperAdapter.js',
    'custom/families/chartFamilyMetadata.js',
    'custom/families/chartHumanInteractions.js',
    'custom/families/scatterChartActions.js',
  ]

  for (const modulePath of removedCustomWrapperModules) {
    assert.equal(existsSync(new URL(modulePath, ADAPTERS_DIR)), false)
  }

  const offenders = listJavaScriptFiles(SRC_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      const importsRemovedWrapper = removedCustomWrapperModules
        .some((modulePath) => source.includes(modulePath))
      return importsRemovedWrapper
        ? relative(SRC_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.deepEqual(offenders, [])
})

test('adapters do not keep registry factories or capability merging layers', () => {
  assert.equal(existsSync(new URL('adapterRegistry.js', ADAPTERS_DIR)), false)
  assert.equal(existsSync(new URL('createProviderWidgetAdapter.js', ADAPTERS_DIR)), false)
  assert.equal(existsSync(new URL('capabilityDefinitionResolver.js', ADAPTERS_DIR)), false)
})

test('vega-lite adapters do not keep widget-family semantic adapter mirrors', () => {
  const removedFamilyMirrors = [
    'vegaLite/families/barWidgetAdapter.js',
    'vegaLite/families/heatmapWidgetAdapter.js',
    'vegaLite/families/lineWidgetAdapter.js',
    'vegaLite/families/parallelCoordinatesWidgetAdapter.js',
    'vegaLite/families/sankeyWidgetAdapter.js',
    'vegaLite/families/scatterWidgetAdapter.js',
  ]

  for (const modulePath of removedFamilyMirrors) {
    assert.equal(existsSync(new URL(modulePath, ADAPTERS_DIR)), false)
  }
})

test('adapter public barrel hides internal registry and runtime-provider wrapper details', () => {
  const source = readFileSync(new URL('index.js', ADAPTERS_DIR), 'utf8')
  const internalExports = [
    'RuntimeProviderWidgetAdapter',
    'createRegisteredWidgetAdapterInstance',
    'getRegisteredWidgetAdapter',
    'listRegisteredWidgetAdapters',
    'registerDefaultWidgetAdapters',
    'registerWidgetAdapters',
    'barWidgetAdapter',
    'scatterWidgetAdapter',
    'tableWidgetAdapter',
  ]

  for (const exportName of internalExports) {
    assert.equal(source.includes(exportName), false)
  }
})

test('installWidgetView requires an explicit adapter without registry fallback shims', () => {
  const source = readFileSync(new URL('installWidgetView.js', ADAPTERS_DIR), 'utf8')

  assert.equal(source.includes('adapterRegistry'), false)
  assert.equal(source.includes('adapterDefinition'), false)
  assert.match(source, /requires an explicit widgetAdapter/)
})

test('adapters do not keep runtime-provider wrapper or contract shims', () => {
  const removedRuntimeProviderFiles = [
    'runtimeProviderWidgetAdapter.js',
    'runtimeProvider/agentSurface.js',
    'runtimeProvider/runtimeCalls.js',
    'widgetAdapterContract.js',
  ]

  for (const modulePath of removedRuntimeProviderFiles) {
    assert.equal(existsSync(new URL(modulePath, ADAPTERS_DIR)), false)
  }

  const offenders = listJavaScriptFiles(SRC_DIR)
    .map((fileUrl) => {
      const source = readFileSync(fileUrl, 'utf8')
      const importsDeletedAdapterLayer = [
        /from\s+['"][^'"]*adapters\/runtimeProviderWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*adapters\/widgetAdapterContract\.js['"]/,
        /from\s+['"][^'"]*adapters\/createProviderWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\/runtimeProviderWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\/widgetAdapterContract\.js['"]/,
        /from\s+['"][^'"]*\.\/createProviderWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\.\/runtimeProviderWidgetAdapter\.js['"]/,
        /from\s+['"][^'"]*\.\.\/widgetAdapterContract\.js['"]/,
        /from\s+['"][^'"]*\.\.\/createProviderWidgetAdapter\.js['"]/,
      ].some((pattern) => pattern.test(source))
      return importsDeletedAdapterLayer
        ? relative(SRC_DIR.pathname, fileUrl.pathname)
        : null
    })
    .filter(Boolean)

  assert.deepEqual(offenders, [])
})

const VEGA_LITE_SPEC_ACTION_MODULES = [
  'vegaLite/families/widgetSpecActions.js',
  'vegaLite/families/scatterSpecActions.js',
  'vegaLite/families/barSpecActions.js',
  'vegaLite/families/lineSpecActions.js',
  'vegaLite/families/parallelCoordinatesSpecActions.js',
  'vegaLite/families/heatmapSpecActions.js',
  'vegaLite/families/sankeySpecActions.js',
]

test('vega-lite spec action family modules own shared spec-tree traversal usage', () => {
  assert.equal(existsSync(new URL('vegaLite/specTree.js', ADAPTERS_DIR)), true)
  assert.equal(existsSync(new URL('vegaLite/specModel.js', ADAPTERS_DIR)), true)
  assert.equal(existsSync(new URL('vegaLite/specMutators.js', ADAPTERS_DIR)), true)

  const familySources = VEGA_LITE_SPEC_ACTION_MODULES
    .map((modulePath) => {
      const moduleUrl = new URL(modulePath, ADAPTERS_DIR)
      assert.equal(existsSync(moduleUrl), true)
      return readFileSync(moduleUrl, 'utf8')
    })
    .join('\n')

  assert.match(familySources, /from\s+['"]\.\.\/specTree\.js['"]/)
  assert.match(familySources, /from\s+['"]\.\.\/specModel\.js['"]/)
  assert.match(familySources, /from\s+['"]\.\.\/specMutators\.js['"]/)

  const specTreeSource = readFileSync(new URL('vegaLite/specTree.js', ADAPTERS_DIR), 'utf8')
  assert.equal(/\bexport\s+function\s+(replaceTaggedLayer|replaceTaggedTransform|replaceFilterTransformForField|replaceAggregateTransforms|readMarkType)\b/.test(specTreeSource), false)

  const executorSource = readFileSync(new URL('vegaLite/vegaLiteSpecActionExecutor.js', ADAPTERS_DIR), 'utf8')
  assert.equal(/\bfunction\s+updateRepresentativeSpec\b/.test(executorSource), false)
  assert.equal(/\bfunction\s+findRepresentativeSpec\b/.test(executorSource), false)
  assert.equal(/\bfunction\s+collectNestedSpecs\b/.test(executorSource), false)
})

test('vega-lite spec action executor is a thin router over family spec action modules', () => {
  for (const modulePath of VEGA_LITE_SPEC_ACTION_MODULES) {
    assert.equal(existsSync(new URL(modulePath, ADAPTERS_DIR)), true)
  }

  const executorSource = readFileSync(new URL('vegaLite/vegaLiteSpecActionExecutor.js', ADAPTERS_DIR), 'utf8')
  assert.match(executorSource, /from\s+['"]\.\/families\/widgetSpecActions\.js['"]/)
  assert.match(executorSource, /from\s+['"]\.\/families\/scatterSpecActions\.js['"]/)
  assert.match(executorSource, /from\s+['"]\.\/families\/barSpecActions\.js['"]/)
  assert.match(executorSource, /from\s+['"]\.\/families\/lineSpecActions\.js['"]/)
  assert.match(executorSource, /from\s+['"]\.\/families\/parallelCoordinatesSpecActions\.js['"]/)
  assert.match(executorSource, /from\s+['"]\.\/families\/heatmapSpecActions\.js['"]/)
  assert.match(executorSource, /from\s+['"]\.\/families\/sankeySpecActions\.js['"]/)

  assert.equal(/\bfunction\s+executeVegaLite(?:Change|Zoom|Filter|Aggregate|Sort|Scatter|Bar|Line|Parallel|Heatmap)/.test(executorSource), false)
  assert.equal(/\bfunction\s+executeVegaSankey[A-Z]/.test(executorSource), false)
  assert.equal(/\bfunction\s+is(?:Scatter|Bar|Line|Parallel|Heatmap)/.test(executorSource), false)
  assert.equal(/\bfunction\s+(detect|infer|aggregate|compute|runKMeans)/.test(executorSource), false)
})

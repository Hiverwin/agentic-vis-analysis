import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(new URL('../../../../', import.meta.url).pathname)

const scannedRoots = [
  path.join(repoRoot, 'apps/widgetva-system/src'),
  path.join(repoRoot, 'apps/widgetva-system/extension/src'),
]

const allowedWidgetvaKitEntrySuffixes = new Set([
  '/widgetva-kit/src/core.js',
  '/widgetva-kit/src/coreInspect.js',
  '/widgetva-kit/src/coreRuntime.js',
  '/widgetva-kit/src/transportRuntime.js',
  '/widgetva-kit/src/workspace.js',
  '/widgetva-kit/src/widgets.js',
  '/widgetva-kit/src/adapters/index.js',
  '/widgetva-kit/src/pageIntegrations.js',
])

async function collectSourceFiles(rootDirectory) {
  const entries = await readdir(rootDirectory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(rootDirectory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') return []
      return collectSourceFiles(absolutePath)
    }
    if (!entry.isFile()) return []
    if (!absolutePath.endsWith('.js') && !absolutePath.endsWith('.jsx')) return []
    if (absolutePath.endsWith('/stableEntryBoundary.test.js')) return []
    return [absolutePath]
  }))
  return nested.flat()
}

function readWidgetvaKitImports(sourceText) {
  const matches = sourceText.matchAll(/from\s+['"]([^'"]*widgetva-kit\/src\/[^'"]+)['"]/g)
  return Array.from(matches, (match) => match[1])
}

test('widgetva-system only imports widgetva-kit through approved stable subentry files', async () => {
  const files = (await Promise.all(scannedRoots.map(collectSourceFiles))).flat()
  const violations = []
  const observed = new Set()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const importPath of readWidgetvaKitImports(source)) {
      observed.add(importPath)
      if (![...allowedWidgetvaKitEntrySuffixes].some((suffix) => importPath.endsWith(suffix))) {
        violations.push({
          file,
          importPath,
        })
      }
    }
  }

  assert.deepEqual(violations, [])
  assert.deepEqual(
    Array.from(observed).sort(),
    [
      '../../../../../widgetva-kit/src/coreRuntime.js',
      '../../../../widgetva-kit/src/adapters/index.js',
      '../../../../widgetva-kit/src/core.js',
      '../../../../widgetva-kit/src/coreInspect.js',
      '../../../../widgetva-kit/src/coreRuntime.js',
      '../../../../widgetva-kit/src/transportRuntime.js',
      '../../../../widgetva-kit/src/widgets.js',
      '../../../../widgetva-kit/src/workspace.js',
    ],
  )
})

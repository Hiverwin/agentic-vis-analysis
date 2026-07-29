import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(new URL('../../../../../', import.meta.url).pathname)

const scannedRoots = [
  path.join(repoRoot, 'apps/widgetva-system/src'),
  path.join(repoRoot, 'apps/widgetva-system/extension/src'),
]

const allowedWidgetvaKitEntries = new Set([
  'widgetva-kit',
  'widgetva-kit/page-integrations',
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
    if (absolutePath.endsWith('.test.js')) return []
    return [absolutePath]
  }))
  return nested.flat()
}

function readWidgetvaKitImports(sourceText) {
  const matches = sourceText.matchAll(/from\s+['"](widgetva-kit(?:\/[^'"]+)?)['"]/g)
  return Array.from(matches, (match) => match[1])
}

test('widgetva-system only imports widgetva-kit through approved stable package entries', async () => {
  const files = (await Promise.all(scannedRoots.map(collectSourceFiles))).flat()
  const violations = []
  const observed = new Set()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const importPath of readWidgetvaKitImports(source)) {
      observed.add(importPath)
      if (!allowedWidgetvaKitEntries.has(importPath)) {
        violations.push({
          file,
          importPath,
        })
      }
    }
  }

  assert.deepEqual(violations, [])
  assert.deepEqual(Array.from(observed).sort(), Array.from(allowedWidgetvaKitEntries).sort())
})

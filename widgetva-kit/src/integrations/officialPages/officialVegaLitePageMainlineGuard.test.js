import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const guardedFiles = [
  '../../index.js',
  'officialVegaLitePageIntegrations.js',
  'officialVegaLitePageAgentActions.js',
  '../../core/runtime/materializers/providers/vegaLite/vegaLiteOfficialPageMaterializer.js',
]

const forbiddenPatterns = [
  { label: 'private runtime access', pattern: /\b_runtime\b/ },
  { label: 'signal listener bridge', pattern: /\baddSignalListener\s*\(/ },
  { label: 'signal listener cleanup', pattern: /\bremoveSignalListener\s*\(/ },
  { label: 'store-based data access', pattern: /\bview\.data\s*\(/ },
  { label: 'tuple signal naming', pattern: /_tuple\b/ },
  { label: 'store signal naming', pattern: /_store\b/ },
  { label: 'old official Vega examples entrypoints', pattern: /\bvegaExamples[A-Za-z]*\b/ },
  { label: 'old Vega-Lite examples module naming', pattern: /\bvegaLiteExamples\b/ },
  { label: 'old native interaction module naming', pattern: /\bvegaLiteNativeInteractions\b/ },
  { label: 'old shared-selection compatibility module naming', pattern: /\bvegaLiteSharedSelectionActions(?:Impl)?\b/ },
]

test('official Vega-Lite page agent mainline stays on shared-state rematerialization', async () => {
  for (const relativeFile of guardedFiles) {
    const absoluteFile = path.resolve(__dirname, relativeFile)
    const source = await readFile(absoluteFile, 'utf8')

    for (const { label, pattern } of forbiddenPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `${path.relative(process.cwd(), absoluteFile)} should not include ${label}: ${pattern}`,
      )
    }
  }
})

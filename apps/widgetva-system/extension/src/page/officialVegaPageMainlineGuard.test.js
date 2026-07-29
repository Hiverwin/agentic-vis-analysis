import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const guardedFiles = [
  'officialPageAgentClient.js',
  'officialPageRuntimeManager.js',
  'officialVegaLitePageScript.js',
  'officialVegaLitePageBootstrap.js',
  'officialPageBootstrapLifecycle.js',
  'officialVegaLitePageLifecycle.js',
  'officialPageRuntimeBindings.js',
  'officialVegaLitePageBindings.js',
  'officialPageAgentRunners.js',
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
]

const nonBindingFiles = guardedFiles.filter((relativeFile) => relativeFile !== 'officialPageRuntimeBindings.js')
const forbiddenLegacyHelperPattern = /__widgetVAOfficialPage(?:Read|Execute|Query|Run|Set|Clear|Inspect|Summarize|Configure)[A-Z][A-Za-z]+/g

test('official Vega page extension entrypoints stay on the shared-state rematerialization mainline', async () => {
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

test('official Vega page active source only references legacy global helpers inside the dedicated binding layer', async () => {
  for (const relativeFile of nonBindingFiles) {
    const absoluteFile = path.resolve(__dirname, relativeFile)
    const source = await readFile(absoluteFile, 'utf8')

    assert.equal(
      forbiddenLegacyHelperPattern.test(source),
      false,
      `${path.relative(process.cwd(), absoluteFile)} should not directly reference legacy __widgetVAOfficialPage* helper globals outside officialPageRuntimeBindings.js`,
    )
  }
})

test('official Vega-Lite bootstrap uses the specialized Vega-Lite binding and lifecycle wrappers', async () => {
  const absoluteFile = path.resolve(__dirname, 'officialVegaLitePageBootstrap.js')
  const source = await readFile(absoluteFile, 'utf8')

  assert.match(source, /\bbindOfficialVegaLitePageAgentRuntime\b/)
  assert.doesNotMatch(source, /\bbindOfficialPageAgentRuntime\b/)
  assert.match(source, /\bclearOfficialVegaLitePageBootstrapRuntime\b/)
  assert.match(source, /\bresetOfficialVegaLitePageBootstrapBindings\b/)
  assert.match(source, /from '\.\/officialVegaLitePageBindings\.js'/)
  assert.match(source, /from '\.\/officialVegaLitePageLifecycle\.js'/)
  assert.doesNotMatch(source, /\bclearOfficialPageBootstrapRuntime\b/)
  assert.doesNotMatch(source, /\bresetOfficialPageBootstrapBindings\b/)
})

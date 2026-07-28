import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

const SRC_DIR = new URL('../', import.meta.url).pathname

function readSource(relativePath) {
  return readFileSync(join(SRC_DIR, relativePath), 'utf8')
}

test('rendering layer does not fallback to concrete human interaction bindings', () => {
  const source = readSource('core/rendering/WidgetRendererBridge.js')
  assert.equal(source.includes('humanInteractionBindings'), false)
  assert.equal(source.includes('bindWidgetHumanInteractions'), false)
})

test('Vega-Lite owns concrete human interaction bindings', () => {
  assert.equal(existsSync(join(SRC_DIR, 'adapters/vegaLite/humanInteractionBindings.js')), true)
  assert.equal(existsSync(join(SRC_DIR, 'adapters/humanInteractionBindings.js')), false)
})

test('widget family interaction profiles stay declarative', () => {
  const familiesDir = join(SRC_DIR, 'widgets/families')
  const offenders = []
  const missingProfiles = []

  for (const entry of readdirSync(familiesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'shared') continue
    const familyDir = join(familiesDir, entry.name)
    const oldHumanBindings = join(familyDir, 'humanBindings.js')
    if (existsSync(oldHumanBindings)) {
      offenders.push(relative(SRC_DIR, oldHumanBindings))
    }

    const profilePath = join(familyDir, 'interactionProfile.js')
    if (!existsSync(profilePath)) {
      missingProfiles.push(entry.name)
      continue
    }

    const profileSource = readFileSync(profilePath, 'utf8')
    if (/add(Event|Signal)Listener|remove(Event|Signal)Listener|closest\s*\(|dataset\./.test(profileSource)) {
      offenders.push(relative(SRC_DIR, profilePath))
    }
    assert.equal(
      basename(profilePath),
      'interactionProfile.js',
      `${entry.name} should expose its declarative profile through interactionProfile.js`,
    )
  }

  assert.deepEqual(missingProfiles, [])
  assert.deepEqual(offenders, [])
})

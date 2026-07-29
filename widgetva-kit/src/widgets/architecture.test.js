import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { relative } from 'node:path'

const WIDGETS_DIR = new URL('.', import.meta.url)

function listFiles(dirUrl) {
  const files = []
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    const entryUrl = new URL(entry.name, dirUrl)
    if (entry.isDirectory()) {
      files.push(...listFiles(new URL(`${entry.name}/`, dirUrl)))
    } else if (entry.isFile()) {
      files.push(entryUrl)
    }
  }
  return files
}

test('table stays out of widget-family semantic modules', () => {
  const tableFiles = listFiles(WIDGETS_DIR)
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => path.split('/').includes('table'))

  assert.deepEqual(tableFiles, [])
})

test('provider state application stays out of widget-family semantic modules', () => {
  const stateFiles = listFiles(new URL('families/', WIDGETS_DIR))
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => path.endsWith('/state.js') || path === 'families/shared/applyVegaLiteState.js')

  assert.deepEqual(stateFiles, [])
})

test('shared semantic patch helpers stay under widget-family shared modules', () => {
  const rootPatchHelpers = listFiles(new URL('families/', WIDGETS_DIR))
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => /^families\/[^/]+Patch\.js$/.test(path))

  assert.deepEqual(rootPatchHelpers, [])
})

test('generic widget runtime implementation stays outside the shared helper folder', () => {
  const sharedDir = new URL('families/shared/', WIDGETS_DIR)
  const genericDir = new URL('families/generic/', WIDGETS_DIR)

  assert.equal(readdirSync(genericDir).includes('runtimeActions.js'), true)
  assert.equal(readdirSync(genericDir).includes('semanticPatches.js'), true)
  assert.equal(readdirSync(sharedDir).includes('sharedWidgetRuntimeActions.js'), false)
  assert.equal(readdirSync(sharedDir).includes('widgetSemanticPatches.js'), false)
})

test('primitive terminology stays out of widget-family implementation filenames', () => {
  const primitiveFiles = listFiles(new URL('families/', WIDGETS_DIR))
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => path.toLowerCase().includes('primitive'))

  assert.deepEqual(primitiveFiles, [])
})

test('runtime-bound widget facades stay out of widgets', () => {
  const facadeFiles = listFiles(WIDGETS_DIR)
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => path === 'widgetInstance.js' || path === 'pool.js')

  assert.deepEqual(facadeFiles, [])
})

test('agent/runtime contract facades stay out of widgets', () => {
  const contractFacadeFiles = listFiles(WIDGETS_DIR)
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => path.split('/')[0] === 'contracts')

  assert.deepEqual(contractFacadeFiles, [])
})

test('runtime action handlers stay out of widget families', () => {
  const runtimeFiles = listFiles(new URL('families/', WIDGETS_DIR))
    .map((fileUrl) => relative(WIDGETS_DIR.pathname, fileUrl.pathname))
    .filter((path) => path.endsWith('/actions.js'))

  assert.deepEqual(runtimeFiles, [])
})

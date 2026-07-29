import test from 'node:test'
import assert from 'node:assert/strict'
import * as integrations from './page-integrations.js'

test('page integration facade exposes the browser integration surface', () => {
  for (const name of [
    'bootstrapObservableD3Page',
    'findPrimaryObservableD3Surface',
    'attachWidgetVAToOfficialVegaLitePage',
    'installVegaEmbedCapture',
  ]) {
    assert.equal(typeof integrations[name], 'function', name)
  }
})

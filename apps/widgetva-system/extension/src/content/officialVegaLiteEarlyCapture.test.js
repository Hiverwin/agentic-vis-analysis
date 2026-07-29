import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildEarlyVegaEmbedCaptureScript,
  installEarlyVegaEmbedCapture,
} from './officialVegaLiteEarlyCapture.js'

test('installEarlyVegaEmbedCapture captures a later vegaEmbed assignment and call', async () => {
  const root = {}
  const fakeView = { id: 'captured_view' }

  const capture = installEarlyVegaEmbedCapture(root)
  root.vegaEmbed = async () => ({ view: fakeView })
  const result = await root.vegaEmbed('#vis', { mark: 'point' }, { actions: false })

  assert.equal(result.view, fakeView)
  assert.equal(capture.hasCapturedView(), true)
  assert.equal(capture.getLatest().view, fakeView)
  assert.equal(capture.getLatest().target, '#vis')
})

test('buildEarlyVegaEmbedCaptureScript returns an executable inline installer', async () => {
  const root = {}
  const scriptSource = buildEarlyVegaEmbedCaptureScript()
  const installer = new Function('window', scriptSource)

  installer(root)
  root.vegaEmbed = async () => ({ view: { id: 'inline_capture' } })
  await root.vegaEmbed('#chart', { mark: 'bar' })

  assert.equal(root.__widgetvaVegaEmbedCapture.hasCapturedView(), true)
})

test('installEarlyVegaEmbedCapture also captures embedExample assignments', async () => {
  const root = {}
  const fakeView = { id: 'embed_example_capture' }

  const capture = installEarlyVegaEmbedCapture(root)
  root.embedExample = async () => fakeView
  const result = await root.embedExample('#point_2d', { mark: 'point' }, false)

  assert.equal(result, fakeView)
  assert.equal(capture.getLatest().source, 'embedExample')
  assert.equal(capture.getLatest().view, fakeView)
})

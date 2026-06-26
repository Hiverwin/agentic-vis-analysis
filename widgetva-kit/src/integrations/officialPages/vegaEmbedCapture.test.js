import test from 'node:test'
import assert from 'node:assert/strict'

import { installVegaEmbedCapture, readLatestVegaEmbedCapture } from './vegaEmbedCapture.js'

test('installVegaEmbedCapture wraps an existing vegaEmbed function and records the latest view', async () => {
  const fakeView = { id: 'view_a' }
  const root = {
    vegaEmbed: async (...args) => ({
      args,
      view: fakeView,
    }),
  }

  const capture = installVegaEmbedCapture(root)
  const result = await root.vegaEmbed('#vis', { mark: 'point' }, { renderer: 'svg' })

  assert.equal(capture.isInstalled, true)
  assert.equal(result.view, fakeView)
  assert.equal(capture.hasCapturedView(), true)
  assert.equal(readLatestVegaEmbedCapture(root)?.view, fakeView)
  assert.deepEqual(readLatestVegaEmbedCapture(root)?.spec, { mark: 'point' })
})

test('installVegaEmbedCapture also captures vegaEmbed assigned after installation', async () => {
  const fakeView = { id: 'view_b' }
  const root = {}

  const capture = installVegaEmbedCapture(root)
  root.vegaEmbed = async () => ({ view: fakeView })

  const result = await root.vegaEmbed('#vis', { mark: 'line' })

  assert.equal(capture.isInstalled, true)
  assert.equal(result.view, fakeView)
  assert.equal(readLatestVegaEmbedCapture(root)?.view, fakeView)
  assert.deepEqual(readLatestVegaEmbedCapture(root)?.spec, { mark: 'line' })
})

test('installVegaEmbedCapture also captures embedExample assigned after installation', async () => {
  const fakeView = { id: 'view_c' }
  const root = {}

  const capture = installVegaEmbedCapture(root)
  root.embedExample = async () => fakeView

  const result = await root.embedExample('#point_2d', { mark: 'point' }, false)

  assert.equal(capture.isInstalled, true)
  assert.equal(result, fakeView)
  assert.equal(readLatestVegaEmbedCapture(root)?.source, 'embedExample')
  assert.equal(readLatestVegaEmbedCapture(root)?.view, fakeView)
  assert.deepEqual(readLatestVegaEmbedCapture(root)?.spec, { mark: 'point' })
})

import test from 'node:test'
import assert from 'node:assert/strict'

import { readStatePatch } from './readStatePatch.js'

test('readStatePatch prefers store.buildStatePatch when available', () => {
  const refs = ['wl://demo/workspace/main/widget/scatter_a']
  const patch = {
    'wl://demo/workspace/main/widget/scatter_a': {
      selections: {
        brush: true,
      },
    },
  }

  assert.deepEqual(
    readStatePatch({
      buildStatePatch(receivedRefs) {
        assert.deepEqual(receivedRefs, refs)
        return patch
      },
    }, refs),
    patch,
  )
})

test('readStatePatch falls back to store.readState when buildStatePatch is unavailable', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const patch = readStatePatch({
    readState(options = {}) {
      assert.deepEqual(options.refs, [widgetRef, 'shared'])
      return {
        widgets: {
          [widgetRef]: {
            ref: widgetRef,
            version: 2,
          },
        },
        shared: {
          focusedWidget: widgetRef,
        },
      }
    },
  }, [widgetRef, 'shared'])

  assert.deepEqual(patch, {
    [widgetRef]: {
      ref: widgetRef,
      version: 2,
    },
    shared: {
      focusedWidget: widgetRef,
    },
  })
})

test('readStatePatch falls back to plain RuntimeStore record facades when readState is unavailable', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const patch = readStatePatch({
    stateId: 'main:s2',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        version: 2,
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
  }, [widgetRef, 'shared'])

  assert.deepEqual(patch, {
    [widgetRef]: {
      ref: widgetRef,
      version: 2,
    },
    shared: {
      focusedWidget: widgetRef,
      activeSelections: {},
      globalFilters: {},
    },
  })
})

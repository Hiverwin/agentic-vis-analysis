import test from 'node:test'
import assert from 'node:assert/strict'

import { buildScopedParams, readNormalizedQueryScope, readScopedQueryScope } from './queryScope.js'

test('buildScopedParams ignores top-level legacy targetRef and strips removed params targeting fields', () => {
  const scopedParams = buildScopedParams({
    call: {
      targetRef: 'wl://demo/workspace/main/widget/bar_a',
      params: {
        limit: 5,
        targetDataRef: 'wl://demo/workspace/main/data/current_selection',
        selectionRef: 'wl://demo/workspace/main/widget/bar_a/selection/current',
      },
    },
  })

  assert.deepEqual(scopedParams, {
    limit: 5,
  })
})

test('buildScopedParams preserves data queryScope while dropping widget targeting', () => {
  const scopedParams = buildScopedParams({
    params: {
      queryScope: {
        widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
        dataRef: 'wl://demo/workspace/main/data/current_view',
      },
      xField: 'Horsepower',
      yField: 'Miles_per_Gallon',
    },
  })

  assert.deepEqual(scopedParams, {
    queryScope: {
      dataRef: 'wl://demo/workspace/main/data/current_view',
      selectionRef: null,
      focusRef: null,
      viewportRef: null,
    },
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
  })
})

test('buildScopedParams ignores legacy target aliases nested inside queryScope', () => {
  const scopedParams = buildScopedParams({
    params: {
      queryScope: {
        targetRef: 'wl://demo/workspace/main/widget/scatter_a',
        targetDataRef: 'wl://demo/workspace/main/data/current_view',
        selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/current',
      },
    },
  })

  assert.deepEqual(scopedParams, {
    queryScope: {
      dataRef: null,
      selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/current',
      focusRef: null,
      viewportRef: null,
    },
  })
})

test('readNormalizedQueryScope reads widget target from target while ignoring queryScope.widgetRef', () => {
  const scope = readNormalizedQueryScope({
    call: {
      target: { widgetRef: 'wl://demo/workspace/main/widget/line_a' },
      queryScope: {
        widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
        dataRef: 'wl://demo/workspace/main/data/current_view',
      },
    },
  })

  assert.deepEqual(scope, {
    widgetRef: 'wl://demo/workspace/main/widget/line_a',
    dataRef: 'wl://demo/workspace/main/data/current_view',
    selectionRef: null,
    focusRef: null,
    viewportRef: null,
  })
})

test('readScopedQueryScope never exposes widgetRef', () => {
  const scope = readScopedQueryScope({
    call: {
      target: { widgetRef: 'wl://demo/workspace/main/widget/line_a' },
      queryScope: {
        widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
        dataRef: 'wl://demo/workspace/main/data/current_view',
      },
    },
  })

  assert.deepEqual(scope, {
    dataRef: 'wl://demo/workspace/main/data/current_view',
    selectionRef: null,
    focusRef: null,
    viewportRef: null,
  })
})

test('readNormalizedQueryScope preserves top-level targetRef while ignoring removed nested selection/data targeting fields', () => {
  const scope = readNormalizedQueryScope({
    call: {
      targetRef: 'wl://demo/workspace/main/widget/line_a',
      params: {
        targetDataRef: 'wl://demo/workspace/main/data/current_selection',
        selectionRef: 'wl://demo/workspace/main/widget/line_a/selection/current',
      },
    },
  })

  assert.deepEqual(scope, {
    widgetRef: 'wl://demo/workspace/main/widget/line_a',
    dataRef: null,
    selectionRef: null,
    focusRef: null,
    viewportRef: null,
  })
})

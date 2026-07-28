import test from 'node:test'
import assert from 'node:assert/strict'

import { applyVegaLiteRuntimeState } from './applyVegaLiteState.js'

test('applyVegaLiteRuntimeState replaces Vega view data from runtime currentDataRef rows', async () => {
  const rows = [
    { Origin: 'Japan', count: 3 },
    { Origin: 'USA', count: 2 },
  ]
  const changes = []
  let ran = false
  const view = {
    __widgetVAChangesetFactory() {
      return {
        _remove: null,
        _insert: null,
        remove(predicate) {
          this._remove = predicate
          return this
        },
        insert(values) {
          this._insert = values
          return this
        },
      }
    },
    getState() {
      return {
        data: {
          source_0: [{ Origin: 'Europe', count: 1 }],
        },
      }
    },
    change(name, changeset) {
      changes.push({ name, changeset })
      return this
    },
    async runAsync() {
      ran = true
    },
  }

  const result = await applyVegaLiteRuntimeState({
    view,
    state: {
      data: {
        currentDataRef: 'data://bar/current',
      },
    },
    runtime: {
      store: {
        readRuntimeData(ref) {
          return ref === 'data://bar/current' ? { rows } : null
        },
      },
    },
  })

  assert.equal(changes.length, 1)
  assert.equal(changes[0].name, 'source_0')
  assert.equal(typeof changes[0].changeset._remove, 'function')
  assert.deepEqual(changes[0].changeset._insert, rows)
  assert.equal(ran, true)
  assert.equal(result?.data?.applied, true)
  assert.deepEqual(result?.data?.dataNames, ['source_0'])
})

test('applyVegaLiteRuntimeState only replaces source-like Vega data names by default', async () => {
  const rows = [{ Origin: 'Japan', count: 3 }]
  const changes = []
  const view = {
    __widgetVAChangesetFactory() {
      return {
        remove() { return this },
        insert(values) {
          this.values = values
          return this
        },
      }
    },
    getState() {
      return {
        data: {
          source_0: [{ Origin: 'Europe', count: 1 }],
          marks: [{ datum: { Origin: 'Europe' } }],
          legend_entries: [{ label: 'Europe' }],
        },
      }
    },
    change(name, changeset) {
      changes.push({ name, values: changeset.values })
      return this
    },
    async runAsync() {},
  }

  await applyVegaLiteRuntimeState({
    view,
    state: {
      data: {
        currentDataRef: 'data://bar/current',
      },
    },
    runtime: {
      store: {
        readRuntimeData() {
          return { rows }
        },
      },
    },
  })

  assert.deepEqual(changes.map((entry) => entry.name), ['source_0'])
})

test('applyVegaLiteRuntimeState clears Vega source data when runtime rows are empty', async () => {
  const changes = []
  const view = {
    __widgetVAChangesetFactory() {
      return {
        remove() { return this },
        insert(values) {
          this.values = values
          return this
        },
      }
    },
    getState() {
      return {
        data: {
          source_0: [{ Origin: 'Europe', count: 1 }],
        },
      }
    },
    change(name, changeset) {
      changes.push({ name, values: changeset.values })
      return this
    },
    async runAsync() {},
  }

  const result = await applyVegaLiteRuntimeState({
    view,
    state: {
      data: {
        currentDataRef: 'data://bar/current',
      },
    },
    runtime: {
      store: {
        readRuntimeData() {
          return { rows: [] }
        },
      },
    },
  })

  assert.deepEqual(changes, [{ name: 'source_0', values: [] }])
  assert.equal(result?.data?.applied, true)
})

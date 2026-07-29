import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createOfficialPageManagedRequestRunner,
} from './officialPageAgentRunners.js'
import {
  attachOfficialPageController,
  ensureOfficialPageRuntimeManager,
} from './officialPageRuntimeManager.js'

function createRoot() {
  return {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
  }
}

test('createOfficialPageManagedRequestRunner routes natural-language string requests through the managed runner', async () => {
  const entry = {}
  const root = createRoot()
  const pagePort = {
    kind: 'page-port',
  }
  const workspace = {
    kind: 'workspace',
    async readObservation() {
      return { ok: true }
    },
  }

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort,
    workspace,
  })

  const request = createOfficialPageManagedRequestRunner({
    entry,
    root,
    pagePort,
    runAgentLoop: () => {
      throw new Error('runAgentLoop should not be used for plain string requests.')
    },
    runNaturalLanguageTurn: async (currentWorkspace, objective) => ({
      ok: true,
      currentWorkspace,
      objective,
    }),
    runNaturalLanguageLoop: async () => {
      throw new Error('runNaturalLanguageLoop should not be used for plain string requests.')
    },
    rebootstrap: async () => {},
    configureAgent: async () => null,
    readAgentConfig: async () => null,
  })

  const result = await request('analyze this chart')

  assert.deepEqual(result, {
    ok: true,
    currentWorkspace: workspace,
    objective: 'analyze this chart',
  })
})

test('createOfficialPageManagedRequestRunner routes natural-language sessions through the controller workspace', async () => {
  const entry = {}
  const root = createRoot()
  const pagePort = { kind: 'page-port-without-observation' }
  const workspace = {
    kind: 'workspace',
    async readObservation() {
      return { ok: true, source: 'workspace' }
    },
  }

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort,
    workspace,
  })

  const request = createOfficialPageManagedRequestRunner({
    entry,
    root,
    pagePort,
    runAgentLoop: async () => null,
    runNaturalLanguageTurn: async () => {
      throw new Error('runNaturalLanguageTurn should not be used for session requests.')
    },
    runNaturalLanguageLoop: async (target, options = {}) => ({
      ok: true,
      target,
      options,
    }),
    rebootstrap: async () => {},
    configureAgent: async () => null,
    readAgentConfig: async () => null,
  })

  const onTurn = () => {}
  const result = await request({
    mode: 'runNaturalLanguageLoop',
    options: { objective: 'explain this chart', onTurn },
  })

  assert.equal(result.target, workspace)
  assert.equal(result.options.objective, 'explain this chart')
  assert.equal(result.options.onTurn, onTurn)
})

test('createOfficialPageManagedRequestRunner routes agentLoop requests through the active controller', async () => {
  const entry = {}
  const root = createRoot()

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort: { kind: 'page-port' },
    async runAgentLoop(options = {}) {
      return {
        ok: true,
        source: 'controller',
        options,
      }
    },
  })

  const request = createOfficialPageManagedRequestRunner({
    entry,
    root,
    pagePort: { kind: 'page-port' },
    runAgentLoop: (currentController, options = {}) => currentController.runAgentLoop(options),
    runNaturalLanguageTurn: async () => null,
    runNaturalLanguageLoop: async () => null,
    rebootstrap: async () => {},
    configureAgent: async () => null,
    readAgentConfig: async () => null,
  })

  const result = await request({
    mode: 'runAgentLoop',
    options: { objective: 'focus top values' },
  })

  assert.deepEqual(result, {
    ok: true,
    source: 'controller',
    options: { objective: 'focus top values' },
  })
})

test('createOfficialPageManagedRequestRunner retries once after a recoverable runtime/controller failure', async () => {
  const entry = {}
  const root = createRoot()
  const rebootstrapCalls = []
  let shouldFailOnce = true

  ensureOfficialPageRuntimeManager(entry)

  async function installController({ forceReattach = false } = {}) {
    rebootstrapCalls.push(forceReattach)
    await attachOfficialPageController(entry, {
      pagePort: { kind: forceReattach ? 'reattached-page-port' : 'initial-page-port' },
      async runAgentLoop(options = {}) {
        if (shouldFailOnce) {
          shouldFailOnce = false
          throw new Error('RuntimeManager does not have an active controller.')
        }
        return {
          ok: true,
          source: forceReattach ? 'reattached-controller' : 'initial-controller',
          options,
        }
      },
    })
  }

  await installController()

  const request = createOfficialPageManagedRequestRunner({
    entry,
    root,
    pagePort: { kind: 'initial-page-port' },
    runAgentLoop: (currentController, options = {}) => currentController.runAgentLoop(options),
    runNaturalLanguageTurn: async () => null,
    runNaturalLanguageLoop: async () => null,
    rebootstrap: installController,
    configureAgent: async () => null,
    readAgentConfig: async () => null,
  })

  const result = await request({
    mode: 'runAgentLoop',
    options: { objective: 'continue request' },
  })

  assert.deepEqual(rebootstrapCalls.slice(-2), [false, true])
  assert.deepEqual(result, {
    ok: true,
    source: 'reattached-controller',
    options: { objective: 'continue request' },
  })
})

test('createOfficialPageManagedRequestRunner routes pagePort methods through the managed request surface', async () => {
  const entry = {}
  const root = createRoot()
  const pagePort = {
    async describeWorkspace(options = {}) {
      return { ok: true, method: 'describeWorkspace', options }
    },
    async readObservation(options = {}) {
      return { ok: true, method: 'readObservation', options }
    },
    async executeAction(call = {}) {
      return { ok: true, method: 'executeAction', call }
    },
    async executeVerifiedAction(call = {}) {
      return { ok: true, method: 'executeVerifiedAction', call }
    },
    async queryPerception(call = {}) {
      return { ok: true, method: 'queryPerception', call }
    },
    async runDataQuery(call = {}) {
      return { ok: true, method: 'runDataQuery', call }
    },
    async readLatestCoordinationResult() {
      return { ok: true, method: 'readLatestCoordinationResult' }
    },
  }

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort,
  })

  const request = createOfficialPageManagedRequestRunner({
    entry,
    root,
    pagePort,
    runAgentLoop: async () => null,
    runNaturalLanguageTurn: async () => null,
    runNaturalLanguageLoop: async () => null,
    rebootstrap: async () => {},
    configureAgent: async () => null,
    readAgentConfig: async () => null,
  })

  assert.deepEqual(await request({
    mode: 'describeWorkspace',
    options: { includeSchemas: false },
  }), {
    ok: true,
    method: 'describeWorkspace',
    options: { includeSchemas: false },
  })
  assert.deepEqual(await request({
    mode: 'readObservation',
    options: { refs: ['scatter-ref'] },
  }), {
    ok: true,
    method: 'readObservation',
    options: { refs: ['scatter-ref'] },
  })
  assert.deepEqual(await request({
    mode: 'executeAction',
    call: { name: 'scatter.brushRegion' },
  }), {
    ok: true,
    method: 'executeAction',
    call: { name: 'scatter.brushRegion' },
  })
  assert.deepEqual(await request({
    mode: 'executeVerifiedAction',
    call: { name: 'scatter.brushRegion' },
  }), {
    ok: true,
    method: 'executeVerifiedAction',
    call: { name: 'scatter.brushRegion' },
  })
  assert.deepEqual(await request({
    mode: 'queryPerception',
    call: { name: 'perception.inspectVisibleRows' },
  }), {
    ok: true,
    method: 'queryPerception',
    call: { name: 'perception.inspectVisibleRows' },
  })
  assert.deepEqual(await request({
    mode: 'runDataQuery',
    call: { name: 'data.visible.sampleRows' },
  }), {
    ok: true,
    method: 'runDataQuery',
    call: { name: 'data.visible.sampleRows' },
  })
  assert.deepEqual(await request({
    mode: 'readLatestCoordinationResult',
  }), {
    ok: true,
    method: 'readLatestCoordinationResult',
  })
})

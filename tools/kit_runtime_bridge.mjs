#!/usr/bin/env node

import fs from 'node:fs'
import readline from 'node:readline'
import { createWidgetVAHost } from '../widgetva-kit/src/host/createWidgetVAHost.js'
import { runWidgetVAAgentSession } from '../widgetva-kit/src/index.js'
import {
  buildPlannerContext,
  buildPlannerContextFromInstance,
} from '../widgetva-kit/src/core/agent/context/plannerContext.js'
import { normalizeBenchmarkSpec } from './benchmark_spec_normalization.mjs'
if (!globalThis.window) globalThis.window = {}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function resolvePath(basePath, value) {
  if (typeof value !== 'string') return value
  return value.startsWith('/') ? value : `${basePath}/${value}`
}

function buildRuntime(instancePath) {
  const instance = readJson(instancePath)
  const baseDir = new URL('../', import.meta.url).pathname.replace(/\/$/, '')
  const widgetEntries = Object.entries(instance.workspace?.widgets || {})
  const materialization = instance.materializations?.vega || Object.values(instance.materializations || {})[0]
  const materializedWidgets = materialization?.widgets || {}
  const declaredRef = widgetEntries.find(([, widget]) => typeof widget?.ref === 'string')?.[1]?.ref || ''
  const declaredAppId = declaredRef.match(/^wl:\/\/([^/]+)\//)?.[1] || 'visagentbench'
  const specs = {}
  for (const [widgetId, widgetDef] of widgetEntries) {
    const specPath = resolvePath(baseDir, materializedWidgets?.[widgetId]?.spec_path)
    specs[widgetId] = specPath ? normalizeBenchmarkSpec(readJson(specPath)) : null
  }
  const primaryWidgetId = widgetEntries[0]?.[0] || null
  const workspaceSpec = {
    topology: widgetEntries.length > 1 ? 'T2' : 'T1',
    widgets: widgetEntries.map(([widgetId, widget]) => ({
    widgetId,
      kind: widget.kind,
      role: widgetId === primaryWidgetId ? 'primary' : 'secondary',
      source: { kind: 'templateSpec', spec: specs[widgetId] },
    })),
    links: (instance.workspace?.links || []).map((link) => ({
      ...clone(link),
      ...(link.sourceStateRef && link.targetStateRef
        ? { relation: link.relation === 'derives' ? 'derives' : 'controls' }
        : {}),
      ...(link.ref ? { linkId: link.ref } : {}),
    })),
  }
  const host = createWidgetVAHost()
  const session = host.createRuntimeSession({
    sessionId: instance.workspace?.workspace_id || instance.task_id,
    workspaceId: instance.workspace?.workspace_id || instance.task_id,
    workspaceSpec,
    links: workspaceSpec.links,
    userIntent: instance.query,
    initialFocusedWidgetId: primaryWidgetId,
    appId: declaredAppId,
  })
  return { instance, session, runtime: session.runtime, specs, workspaceSpec, primaryWidgetId }
}

function response(id, result, error = null) {
  return JSON.stringify({ id, ok: !error, result: error ? null : clone(result), error })
}

const instancePath = process.argv[2]
if (!instancePath) {
  process.stderr.write('Usage: kit_runtime_bridge.mjs <instance.json>\n')
  process.exit(2)
}

const runtimeBundle = buildRuntime(instancePath)
const { runtime, session } = runtimeBundle
const pendingChat = new Map()
const pendingRender = new Map()
let chatCounter = 0
let renderCounter = 0

function requestRender(payload = {}) {
  const requestId = `render_${++renderCounter}`
  return new Promise((resolve, reject) => {
    pendingRender.set(requestId, { resolve, reject })
    process.stdout.write(`${JSON.stringify({
      event: 'render_request',
      request_id: requestId,
      request: payload,
    })}\n`)
  })
}

function describeKitWorkspace() {
  return runtime.describeWorkspace()
}

function buildRenderRequest(state = null) {
  const workspace = runtime.describeWorkspace()
  return {
    renderer: 'vega',
    stateId: state?.stateId || null,
    focusedWidgetId: runtimeBundle.primaryWidgetId,
    widgets: (workspace.widgets || []).map((widget) => ({
      widgetId: widget.widgetId,
      spec: runtime.readWidgetRenderPayload(widget.widgetId)?.providerSpec?.spec || null,
    })),
  }
}

async function renderCurrentState(state = runtime.readState()) {
  return requestRender(buildRenderRequest(state))
}

session.setViewSnapshotProvider(async ({ state }) => {
  const rendered = await renderCurrentState(state)
  if (!rendered?.image_base64) return null
  const mimeType = rendered.mimeType || 'image/png'
  const image = {
    ref: rendered.ref || `widgetva-image:${state?.stateId || 'current'}`,
    mimeType,
    data: rendered.image_base64.startsWith('data:')
      ? rendered.image_base64
      : `data:${mimeType};base64,${rendered.image_base64}`,
    width: rendered.width || null,
    height: rendered.height || null,
  }
  return {
    snapshot: { ref: image.ref, mimeType, width: image.width, height: image.height },
    image,
    summary: state?.summary || null,
  }
})

const agentTarget = session.workspace

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on('line', async (line) => {
  let request
  try {
    request = JSON.parse(line)
    let result
    if (request.method === 'chat_response') {
      const pending = pendingChat.get(request.request_id)
      if (pending) {
        pendingChat.delete(request.request_id)
        pending(request.response || { content: '' })
      }
      return
    } else if (request.method === 'render_response') {
      const pending = pendingRender.get(request.request_id)
      if (pending) {
        pendingRender.delete(request.request_id)
        if (request.error) pending.reject(new Error(request.error.message || String(request.error)))
        else pending.resolve(request.response || null)
      }
      return
    } else if (request.method === 'describe') {
      result = { workspace: describeKitWorkspace(), state: runtime.readState() }
    } else if (request.method === 'state') {
      result = runtime.readState(request.options || {})
    } else if (request.method === 'action') {
      result = await runtime.executeAction({
        callId: request.callId || `bench_action_${Date.now()}`,
        actor: 'agent',
        name: request.name,
        target: request.target ? { widgetRef: request.target } : undefined,
        params: request.params || {},
      })
    } else if (request.method === 'perception') {
      result = await runtime.queryPerception({
        callId: request.callId || `bench_perception_${Date.now()}`,
        actor: 'agent',
        name: request.name,
        target: request.target ? { widgetRef: request.target } : undefined,
        params: request.params || {},
      })
    } else if (request.method === 'trace') {
      result = runtime.readTrace(request.options || {})
    } else if (request.method === 'agent_session') {
      const plannerLevel = request.plannerLevel
        ?? runtimeBundle.instance?.planner?.level
        ?? 2
      const plannerContext = request.plannerContext
        ? buildPlannerContextFromInstance(
          { planner_context: request.plannerContext },
          { level: plannerLevel },
        )
        : buildPlannerContextFromInstance(runtimeBundle.instance, { level: plannerLevel })
      result = await runWidgetVAAgentSession({
        target: agentTarget,
        objective: request.objective,
        model: request.model,
        temperature: request.temperature,
        maxTurns: request.maxTurns,
        sessionKnowledge: request.sessionKnowledge || undefined,
        plannerContext,
        plannerLevel,
        onTurn: async ({ index, turn }) => {
          // The observation image is captured before the action. Capture a
          // second image after the action so one-turn tasks expose the actual
          // final view to the benchmark runner and human reviewers.
          const postState = runtime.readState()
          const postRendered = await renderCurrentState(postState)
          process.stdout.write(`${JSON.stringify({
            event: 'agent_turn',
            turn: {
              index: index + 1,
              stateId: turn?.observe?.state?.stateId || null,
              imageRef: turn?.observe?.view?.image?.ref || null,
              operation: turn?.plan?.operation || turn?.plan?.step || null,
              action: {
                ok: turn?.act?.ok ?? turn?.act?.actionResult?.ok ?? null,
                stateId: turn?.act?.stateId || turn?.act?.actionResult?.stateId || null,
                updatedRefs: turn?.act?.updatedRefs || turn?.act?.actionResult?.updatedRefs || [],
                result: turn?.act?.result || turn?.act?.actionResult?.result || null,
              },
              verification: {
                ok: turn?.verify?.ok ?? turn?.verify?.result?.verified ?? null,
                summary: turn?.verify?.summary || turn?.verify?.result?.summary || null,
              },
              answer: turn?.reason?.answer || null,
              postImage: postRendered?.image_base64 ? {
                ref: postRendered.ref || `widgetva-image:${postState?.stateId || 'current'}:post`,
                mimeType: postRendered.mimeType || 'image/png',
                width: postRendered.width || null,
                height: postRendered.height || null,
                data: postRendered.image_base64,
                stateId: postState?.stateId || null,
              } : null,
            },
          })}\n`)
        },
        completeChat: (chatRequest) => new Promise((resolve) => {
          const requestId = `chat_${++chatCounter}`
          pendingChat.set(requestId, resolve)
          process.stdout.write(`${JSON.stringify({ event: 'chat_request', request_id: requestId, request: chatRequest })}\n`)
        }),
      })
    } else {
      throw new Error(`Unknown bridge method: ${request.method}`)
    }
    process.stdout.write(`${response(request.id, result)}\n`)
  } catch (error) {
    process.stdout.write(`${response(request?.id || null, null, {
      message: error instanceof Error ? error.message : String(error),
    })}\n`)
  }
})

process.on('SIGINT', () => {
  runtime.dispose?.()
  process.exit(0)
})

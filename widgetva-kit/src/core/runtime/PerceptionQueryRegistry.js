import { validateAgainstSchema } from './schemaValidation.js'
import { PerceptionContext } from './PerceptionContext.js'
import { evaluateActionEffectVerification } from './actionEffectVerification.js'
import { DataQueryExecutor } from './DataQueryExecutor.js'
import { createDefaultWidgetVAHostBridge } from './hostBridge.js'
import { makePerceptionResult, makeResultError } from '../protocol/results.js'
import { buildScopedParams, readNormalizedQueryScope } from './queryScope.js'
import {
  makePerceptionRegistryCapabilities,
  makePerceptionRegistryCounts,
  makePerceptionRegistryQueryEntry,
  makePerceptionRegistrySummary,
} from '../protocol/perceptionRegistry.js'

function buildQueryError({ call, code, message, details, recoveryHints }) {
  return makePerceptionResult({
    ok: false,
    callId: call?.callId || `query_${Date.now()}`,
    queryName: call?.name || 'unknown',
    error: makeResultError({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    }),
    ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
  })
}

function resolveCallTargetRef(call, descriptor) {
  return readNormalizedQueryScope({ call, descriptor }).widgetRef || null
}

function resolveWidgetSelections(targetWidget) {
  return Object.entries(targetWidget?.selections || {})
    .map(([selectionRef, selectionState]) => ({
      ref: selectionRef,
      selection: selectionState,
    }))
    .filter((entry) => entry.ref && entry.selection)
}

function resolveRequestedSelectionEntries(targetWidget, requestedSelectionRef = null) {
  const selectionEntries = resolveWidgetSelections(targetWidget)
  if (!requestedSelectionRef) return selectionEntries
  return selectionEntries.filter((entry) => entry.ref === requestedSelectionRef)
}

function formatSummaryText({ rowCount = 0, groupCount = 0, fallback = '' } = {}) {
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback.trim()
  if (groupCount > 0) return `${groupCount} grouped summaries over ${rowCount} rows`
  return `${rowCount} rows`
}

function readRootEncoding(spec) {
  if (Array.isArray(spec?.layer) && spec.layer.length > 0) {
    return spec.layer[0]?.encoding || spec.encoding || {}
  }
  return spec?.encoding || {}
}

function isParallelFoldSpec(spec = null) {
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const hasFoldTransform = transforms.some((transform) => Array.isArray(transform?.fold) && transform.fold.length > 0)
  if (!hasFoldTransform) return false
  const encoding = readRootEncoding(spec)
  return ['dimension', 'key', 'variable'].includes(encoding?.x?.field)
}

function countSemanticSelectionRows({ widgetKind = null, spec = null, rows = [] } = {}) {
  const safeRows = Array.isArray(rows) ? rows : []
  if (widgetKind !== 'parallelCoordinates' && !isParallelFoldSpec(spec)) return safeRows.length

  const encoding = readRootEncoding(spec)
  const recordField = typeof encoding?.detail?.field === 'string' && encoding.detail.field.length > 0
    ? encoding.detail.field
    : null
  if (!recordField) return safeRows.length

  return new Set(
    safeRows
      .map((row) => row?.[recordField])
      .filter((value) => value != null)
      .map((value) => JSON.stringify(value)),
  ).size
}

function buildPerceptionTraceNotes({ userVisibleSummary, rationale = null, verification = null } = {}) {
  return {
    ...(typeof userVisibleSummary === 'string' && userVisibleSummary.trim().length > 0
      ? { userVisibleSummary: userVisibleSummary.trim() }
      : {}),
    ...(typeof rationale === 'string' && rationale.trim().length > 0
      ? { rationale: rationale.trim() }
      : {}),
    ...(typeof verification === 'string' && verification.trim().length > 0
      ? { verification: verification.trim() }
      : {}),
  }
}

function summarizeSupportedWidgetKinds(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  const collectedKinds = Array.from(
    new Set(
      entries.flatMap((entry) => (
        Array.isArray(entry?.supportedWidgetKinds)
          ? entry.supportedWidgetKinds
          : []
      )).filter((kind) => typeof kind === 'string' && kind.length > 0),
    ),
  )
  return collectedKinds.length > 0 ? collectedKinds : null
}

function buildHandlerInput(call, descriptor) {
  const params = buildScopedParams({
    params: call?.params || {},
    call,
    descriptor,
  })
  const {
    targetRef: _legacyTargetRef,
    dataRef: _legacyDataRef,
    params: _legacyParams,
    queryScope: _legacyQueryScope,
    ...rawCall
  } = call && typeof call === 'object' ? call : {}
  const input = {
    ...rawCall,
    ...params,
    params,
    queryScope: params.queryScope || null,
  }
  delete input.targetRef
  delete input.dataRef
  return input
}

export class PerceptionQueryRegistry {
  constructor({ store, dataQueryEngine, dataQueryExecutor, traceRecorder, linkEngine, hostBridge } = {}) {
    this.store = store || {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      listWidgetDescriptions() {
        return []
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getWidgetDescription() {
        return null
      },
      readState() {
        return {}
      },
    }
    this.dataQueryEngine = dataQueryEngine || null
    this.traceRecorder = traceRecorder || null
    this.hostBridge = hostBridge || createDefaultWidgetVAHostBridge()
    this.dataQueryExecutor = dataQueryExecutor
      || (this.dataQueryEngine
        ? new DataQueryExecutor({
            store: this.store,
            dataQueryEngine: this.dataQueryEngine,
            traceRecorder: this.traceRecorder,
            hostBridge: this.hostBridge,
          })
        : null)
    this.linkEngine = linkEngine || null
    this.builtinDescriptors = new Map()
    this.handlerEntries = new Map()
    this.registerBuiltinQueries()
  }

  register(descriptor, handler, options = {}) {
    if (!descriptor?.name || typeof handler !== 'function') {
      throw new Error('PerceptionQueryRegistry.register requires a descriptor.name and handler.')
    }
    const supportedWidgetKinds = normalizeSupportedWidgetKinds(
      options.supportedWidgetKinds || descriptor.supportedWidgetKinds || null,
    )
    const entries = this.handlerEntries.get(descriptor.name) || []
    if (entries.some((entry) => sameSupportedKinds(entry.supportedWidgetKinds, supportedWidgetKinds))) {
      throw new Error(`Duplicate perception query registration: ${descriptor.name}`)
    }
    this.builtinDescriptors.set(descriptor.name, descriptor)
    this.handlerEntries.set(descriptor.name, [
      ...entries,
      {
        descriptor,
        handler,
        supportedWidgetKinds,
      },
    ])
  }

  list() {
    const descriptors = this.store.listPerceptionQueries()
    if (descriptors.length > 0) {
      return descriptors.filter((descriptor) => this.handlerEntries.has(descriptor.name))
    }
    return Array.from(this.builtinDescriptors.values())
  }

  has(name, options = {}) {
    const entries = this.handlerEntries.get(name) || []
    const supportedWidgetKinds = normalizeSupportedWidgetKinds(options.supportedWidgetKinds || null)
    if (!supportedWidgetKinds) return entries.length > 0
    return entries.some((entry) => sameSupportedKinds(entry.supportedWidgetKinds, supportedWidgetKinds))
  }

  describeRegistry() {
    const queries = this.list().map((descriptor) => {
      const handlerEntries = this.handlerEntries.get(descriptor.name) || []
      return makePerceptionRegistryQueryEntry({
        name: descriptor.name,
        category: descriptor.category || null,
        targetRef: descriptor.targetRef || null,
        sideEffectFree: descriptor.sideEffectFree !== false,
        evidenceKinds: Array.isArray(descriptor.evidenceKinds) ? [...descriptor.evidenceKinds] : [],
        verificationTargets: Array.isArray(descriptor.verificationTargets) ? [...descriptor.verificationTargets] : [],
        supportedWidgetKinds: summarizeSupportedWidgetKinds(handlerEntries),
        handlerVariantCount: handlerEntries.length,
      })
    })
    let handlerEntryCount = 0
    for (const entries of this.handlerEntries.values()) {
      handlerEntryCount += Array.isArray(entries) ? entries.length : 0
    }
    return makePerceptionRegistrySummary({
      counts: makePerceptionRegistryCounts({
        descriptorCount: queries.length,
        handlerEntryCount,
      }),
      capabilities: makePerceptionRegistryCapabilities({
        paramsValidation: true,
        returnsValidation: true,
        traceRecording: typeof this.traceRecorder?.recordQuery === 'function',
        linkPropagationEvidence: Boolean(this.linkEngine),
      }),
      queries,
    })
  }

  describeContext() {
    return PerceptionContext.describeContract()
  }

  resolveDescriptor(call) {
    return (
      this.store.getPerceptionDescriptor(call?.name, resolveCallTargetRef(call)) ||
      this.builtinDescriptors.get(call?.name) ||
      null
    )
  }

  createContext(call, descriptor) {
    const normalizedCall = buildHandlerInput(call, descriptor)
    return new PerceptionContext({
      store: this.store,
      descriptor,
      call: normalizedCall,
      traceRecorder: this.traceRecorder,
      hostBridge: this.hostBridge,
    })
  }

  resolveHandlerEntry(call, descriptor, targetWidget) {
    const entries = this.handlerEntries.get(call?.name) || []
    if (entries.length === 0) return null
    const widgetKind = targetWidget?.kind || null
    const targetRef = resolveCallTargetRef(call, descriptor)
    if (widgetKind) {
      const exactKindEntry = entries.find((entry) => entry.supportedWidgetKinds?.includes(widgetKind))
      if (exactKindEntry) return exactKindEntry
    }
    if (targetRef) {
      const scopedEntry = entries.find((entry) => entry.descriptor?.targetRef === targetRef)
      if (scopedEntry) return scopedEntry
    }
    return entries.find((entry) => !entry.supportedWidgetKinds || entry.supportedWidgetKinds.length === 0) || entries[0]
  }

  async query(call) {
    const descriptor = this.resolveDescriptor(call)
    const ctx = this.createContext(call, descriptor)
    const targetWidget = ctx.resolveTargetWidget()
    const handlerEntry = this.resolveHandlerEntry(call, descriptor, targetWidget)
    if (!handlerEntry?.handler) {
      this.traceRecorder?.recordQueryFailure?.({
        call,
        code: 'UNKNOWN_QUERY',
        message: `Unsupported WidgetVA perception query: ${call?.name || 'unknown'}.`,
        recoveryHints: ['Call describeWorkspace() to inspect currently supported perception queries.'],
      })
      return buildQueryError({
        call,
        code: 'UNKNOWN_QUERY',
        message: `Unsupported WidgetVA perception query: ${call?.name || 'unknown'}.`,
        recoveryHints: ['Call describeWorkspace() to inspect currently supported perception queries.'],
      })
    }

    if (descriptor?.paramsSchema) {
      try {
        validateAgainstSchema(ctx.readCallParams(), descriptor.paramsSchema, 'params')
      } catch (error) {
        this.traceRecorder?.recordQueryFailure?.({
          call,
          code: 'INVALID_PARAMS',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the query paramsSchema in describeWorkspace() before retrying.'],
        })
        return buildQueryError({
          call,
          code: 'INVALID_PARAMS',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the query paramsSchema in describeWorkspace() before retrying.'],
        })
      }
    }

    try {
      const output = await handlerEntry.handler(buildHandlerInput(call, descriptor), ctx)
      if (descriptor?.returnsSchema) {
        validateAgainstSchema(output?.result, descriptor.returnsSchema, 'result')
      }
      const tracePayload = ctx.consumeRecordedQuery?.() || null
      if (tracePayload) {
        this.traceRecorder?.recordQuery?.(tracePayload)
      }
      return makePerceptionResult({
        ok: true,
        callId: call?.callId || `call_${Date.now()}`,
        queryName: call?.name || 'unknown',
        result: output?.result,
      })
    } catch (error) {
      this.traceRecorder?.recordQueryFailure?.({
        call,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Call readState() or describeWorkspace() to verify the current target widget and data refs.',
          'Retry with a focused widget/query combination that is declared in the current workspace.',
        ],
      })
      return buildQueryError({
        call,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Call readState() or describeWorkspace() to verify the current target widget and data refs.',
          'Retry with a focused widget/query combination that is declared in the current workspace.',
          'Inspect the query returnsSchema if the runtime result shape does not match the declared contract.',
        ],
      })
    }
  }

  async run(call) {
    return this.query(call)
  }

  registerBuiltinQueries() {
    this.register(
      { name: 'perception.inspectViewConfig' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Inspected the ${targetWidget.kind || 'widget'} view configuration.`,
            rationale: 'View configuration evidence was requested for the current target widget.',
          }),
        })
        return {
          result: {
            ref: targetWidget.ref,
            kind: targetWidget.kind,
            encodings: targetWidget.encodings,
            transforms: targetWidget.transforms,
            view: targetWidget.view,
            selections: targetWidget.selections,
            feedback: targetWidget.feedback || null,
          },
        }
      },
    )

    this.register(
      { name: 'perception.summarizeSelection' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const requestedSelectionRef = params?.queryScope?.selectionRef || null
        const selectionEntries = resolveRequestedSelectionEntries(targetWidget, requestedSelectionRef)
        if (requestedSelectionRef && selectionEntries.length === 0) {
          throw new Error(`Selection ref ${requestedSelectionRef} is not active on the target widget.`)
        }
        const selections = selectionEntries.map((entry) => entry.selection)
        const { rows: visibleRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || null
        let result
        if (selections.length > 0) {
          const filteredRows = selections.reduce(
            (rows, activeSelection) => this.dataQueryEngine.filter(rows, activeSelection.predicates || []),
            visibleRows,
          )
          const semanticSelectedCount = countSemanticSelectionRows({
            widgetKind: targetWidget?.kind || null,
            spec: currentSpec,
            rows: filteredRows,
          })
          const summary = this.dataQueryEngine.summarize(filteredRows, params)
          const summaryRows = Array.isArray(summary?.rows) ? summary.rows : []
          const selectionSummaries = selections.map((selection) => selection.summary || '').filter(Boolean)
          result = {
            hasSelection: true,
            selectionCount: selections.length,
            selectionRefs: selectionEntries.map((entry) => entry.ref),
            dataRef,
            selectedCount: semanticSelectedCount,
            summary: formatSummaryText({
              rowCount: semanticSelectedCount,
              groupCount: summaryRows.length,
              fallback: selectionSummaries.join(' | '),
            }),
            selectionSummaries,
            predicates: selections.flatMap((selection) => selection.predicates || []),
            selectionPredicates: selections.map((selection) => selection.predicates || []),
            groups: summaryRows,
            aggregates: summaryRows,
          }
        } else {
          result = {
            hasSelection: false,
            selectionCount: 0,
            selectionRefs: [],
            dataRef,
            selectedCount: 0,
            summary: '',
            selectionSummaries: [],
            groups: [],
            aggregates: [],
            predicates: [],
            selectionPredicates: [],
          }
        }
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: result.hasSelection
              ? `Summarized ${result.selectedCount} selected rows across ${result.selectionCount} active selection${result.selectionCount === 1 ? '' : 's'}.`
              : 'Confirmed that there is no active selection on the target widget.',
            rationale: 'Selection evidence was requested for the target widget.',
          }),
        })
        return { result }
      },
    )

    this.register(
      { name: 'perception.summarizeVisible' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const { rows: visibleRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const summary = this.dataQueryExecutor.run({
          dataRef,
          query: {
            kind: 'summary',
            spec: params,
          },
        })
        const summaryRows = Array.isArray(summary?.result?.rows) ? summary.result.rows : []
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Summarized ${visibleRows.length} visible rows for the target widget.`,
            rationale: 'Visible-view evidence was requested for the target widget.',
          }),
        })
        return {
          result: {
            dataRef,
            rowCount: visibleRows.length,
            groups: summaryRows,
            aggregates: summaryRows,
            summary: formatSummaryText({
              rowCount: visibleRows.length,
              groupCount: summaryRows.length,
            }),
          },
        }
      },
    )

    this.register(
      { name: 'perception.findExtremes' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const { dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const extremes = this.dataQueryExecutor.run({
          dataRef,
          query: {
            kind: 'findExtremes',
            spec: params,
          },
        })
        const rows = extremes?.result?.rows || []
        const direction = typeof params?.direction === 'string' ? params.direction : 'max'
        const field = typeof params?.field === 'string' ? params.field : 'value'
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Found ${rows.length} ${direction} extreme row${rows.length === 1 ? '' : 's'} for ${field}.`,
            rationale: 'An extremes query was requested for the current target widget.',
          }),
        })
        return {
          result: {
            dataRef,
            field: typeof params?.field === 'string' ? params.field : null,
            direction,
            rows,
          },
        }
      },
    )

    this.register(
      { name: 'perception.inspectVisibleRows' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const { rows: visibleRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const sampledRows = this.dataQueryExecutor.run({
          dataRef,
          query: {
            kind: 'sampleRows',
            spec: { limit: Number.isFinite(params?.limit) ? params.limit : 20 },
          },
        })
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Inspected ${visibleRows.length} visible rows and returned a sample.`,
            rationale: 'Visible-row evidence was requested for the target widget.',
          }),
        })
        return {
          result: {
            ref: targetWidget.ref,
            dataRef,
            visibleCount: visibleRows.length,
            rows: sampledRows?.result || [],
          },
        }
      },
    )

    this.register(
      { name: 'perception.verifyActionEffect' },
      async (call, ctx) => {
        const params = ctx.readCallParams()
        const verification = evaluateActionEffectVerification({
          store: this.store,
          getFinalWorkspaceSnapshot: () => null,
          evaluateLinkPropagation: (options) => this.linkEngine?.evaluatePropagation?.(options) || null,
          actionName: params?.actionName || null,
          stateId: params?.stateId || null,
          refs: params?.refs || [],
          targetRef: params?.queryScope?.widgetRef || null,
          traceLimit: 50,
        })
        ctx.recordQuery({
          affectedRefs: Array.isArray(params?.refs) && params.refs.length > 0
            ? params.refs
            : verification.affectedRefs,
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: verification.verified
              ? `Verified the effect of ${verification.matchedActionName || 'the action'} on the requested runtime refs.`
              : `Verification for ${verification.matchedActionName || 'the action'} found missing refs or propagation mismatches.`,
            rationale: 'Post-action verification evidence was requested from the runtime trace and state patch.',
            verification: verification.verified
              ? 'Trace evidence, state patch, and link propagation checks all matched the requested action effect.'
              : `Missing refs: ${verification.missingRefs.length}. Propagation ok: ${verification.linkPropagation.every((entry) => entry.ok)}.`,
          }),
        })
        return {
          result: verification,
        }
      },
    )
  }
}

function normalizeSupportedWidgetKinds(value) {
  if (!Array.isArray(value) || value.length === 0) return null
  return [...new Set(value.filter((item) => typeof item === 'string' && item.length > 0))].sort()
}

function sameSupportedKinds(left, right) {
  const a = normalizeSupportedWidgetKinds(left)
  const b = normalizeSupportedWidgetKinds(right)
  if (!a && !b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

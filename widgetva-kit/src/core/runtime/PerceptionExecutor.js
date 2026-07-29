import { cloneJsonValue as cloneValue } from '../../shared/clone.js'
import { validateAgainstSchema } from './support/schemaValidation.js'
import { evaluateActionEffectVerification } from './verification/actionEffectVerification.js'
import { DataQueryExecutor } from './DataQueryExecutor.js'
import { createDefaultWidgetVAHostBridge } from '../../host/hostBridge.js'
import { readSnapshotFromStore } from '../../workspace/store/workspaceStoreReaders.js'
import { makePerceptionResult } from '../../contracts/result-contracts.js'
import { PERCEPTION_QUERY_CALL_SCHEMA } from '../../schemas/perception.schema.js'
import {
  PerceptionHandlerContext,
  buildHandlerInput,
  buildPerceptionCallSchemaInput,
  buildPerceptionTraceNotes,
  buildQueryError,
  countSemanticSelectionRows,
  formatSummaryText,
  makePerceptionRegistryCapabilities,
  makePerceptionRegistryCounts,
  makePerceptionRegistryQueryEntry,
  makePerceptionRegistrySummary,
  normalizeSemanticVisibleRows,
  resolveCallTargetRef,
  resolveRequestedSelectionEntries,
  resolveViewConfigEncodings,
  summarizeSupportedWidgetKinds,
} from './executor-support/PerceptionExecutorModels.js'

export class PerceptionExecutor {
  constructor({ store, dataQueryEngine, dataQueryExecutor, traceRecorder, coordinationEngine, hostBridge } = {}) {
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
    this.coordinationEngine = coordinationEngine || null
    this.builtinDescriptors = new Map()
    this.handlerEntries = new Map()
    this.registerBuiltinQueries()
  }

  register(descriptor, handler, options = {}) {
    if (!descriptor?.name || typeof handler !== 'function') {
      throw new Error('PerceptionExecutor.register requires a descriptor.name and handler.')
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
        linkPropagationEvidence: Boolean(this.coordinationEngine),
      }),
      queries,
    })
  }

  describeContext() {
    return PerceptionHandlerContext.describeContract()
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
    return new PerceptionHandlerContext({
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
    try {
      validateAgainstSchema(buildPerceptionCallSchemaInput(call), PERCEPTION_QUERY_CALL_SCHEMA, 'query')
    } catch (error) {
      this.traceRecorder?.recordQueryFailure?.({
        call,
        code: 'INVALID_PARAMS',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the perception query call schema in describeWorkspace() before retrying.'],
      })
      return buildQueryError({
        call,
        code: 'INVALID_PARAMS',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the perception query call schema in describeWorkspace() before retrying.'],
      })
    }
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
            encodings: resolveViewConfigEncodings(targetWidget),
            transforms: targetWidget.transforms,
            view: targetWidget.view,
            selections: targetWidget.selections,
            feedback: targetWidget.feedback || null,
          },
        }
      },
    )

    this.register(
      { name: 'perception.inspectSelection' },
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
        const filteredRows = selections.length > 0
          ? selections.reduce(
              (rows, activeSelection) => this.dataQueryEngine.filter(rows, activeSelection.predicates || []),
              visibleRows,
            )
          : []
        const selectedCount = selections.length > 0
          ? countSemanticSelectionRows({
              widgetKind: targetWidget?.kind || null,
              spec: currentSpec,
              rows: filteredRows,
            })
          : 0
        const result = {
          hasSelection: selectionEntries.length > 0,
          selectionCount: selectionEntries.length,
          selectionRefs: selectionEntries.map((entry) => entry.ref),
          dataRef,
          selectedCount,
          predicates: selectionEntries.flatMap((entry) => entry?.selection?.predicates || []),
          selectionSummaries: selectionEntries
            .map((entry) => entry?.selection?.summary || '')
            .filter((summary) => typeof summary === 'string' && summary.trim().length > 0),
          selections: selectionEntries.map((entry) => ({
            ref: entry.ref,
            kind: entry?.selection?.kind || null,
            summary: entry?.selection?.summary || '',
            predicates: cloneValue(entry?.selection?.predicates || []),
            value: cloneValue(entry?.selection?.value ?? null),
          })),
        }
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: result.hasSelection
              ? `Inspected ${result.selectionCount} active selection${result.selectionCount === 1 ? '' : 's'} covering ${result.selectedCount} row${result.selectedCount === 1 ? '' : 's'}.`
              : 'Confirmed that there is no active selection on the target widget.',
            rationale: 'Selection payload evidence was requested for the target widget.',
          }),
        })
        return { result }
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
          const summary = await this.dataQueryEngine.query(filteredRows, {
            kind: 'summary',
            spec: params,
          })
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
        const { rows: resolvedRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const widgetState = ctx.readCurrentState()?.widgets?.[targetWidget.ref] || null
        const activeSpec = widgetState?.rawSpec || null
        const selectionRef = ctx.resolveImplicitSelectionRefForWidget?.(targetWidget, params?.queryScope || null)
          || ctx.readPrimarySelectionRef?.()
          || null
        const selectionState = selectionRef ? ctx.readSelectionRegistry?.()?.[selectionRef] || null : null
        const selectionPredicates = Array.isArray(selectionState?.predicates) ? selectionState.predicates : []
        const rawVisibleRows = selectionPredicates.length > 0
          ? this.dataQueryEngine.filter(resolvedRows, selectionPredicates)
          : resolvedRows
        const { visibleRows, visibleCount } = normalizeSemanticVisibleRows({
          widgetKind: targetWidget?.kind || null,
          spec: activeSpec,
          rows: rawVisibleRows,
        })
        const summary = await this.dataQueryEngine.query(visibleRows, {
          kind: 'summary',
          spec: params,
        })
        const summaryRows = Array.isArray(summary?.rows) ? summary.rows : []
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Summarized ${visibleCount} visible rows for the target widget.`,
            rationale: 'Visible-view evidence was requested for the target widget.',
          }),
        })
        return {
          result: {
            dataRef,
            rowCount: visibleCount,
            groups: summaryRows,
            aggregates: summaryRows,
            summary: formatSummaryText({
              rowCount: visibleCount,
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
        const { rows: resolvedRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const widgetState = ctx.readCurrentState()?.widgets?.[targetWidget.ref] || null
        const activeSpec = widgetState?.rawSpec || null
        const selectionRef = ctx.resolveImplicitSelectionRefForWidget?.(targetWidget, params?.queryScope || null)
          || ctx.readPrimarySelectionRef?.()
          || null
        const selectionState = selectionRef ? ctx.readSelectionRegistry?.()?.[selectionRef] || null : null
        const selectionPredicates = Array.isArray(selectionState?.predicates) ? selectionState.predicates : []
        const rawVisibleRows = selectionPredicates.length > 0
          ? this.dataQueryEngine.filter(resolvedRows, selectionPredicates)
          : resolvedRows
        const { visibleRows, visibleCount } = normalizeSemanticVisibleRows({
          widgetKind: targetWidget?.kind || null,
          spec: activeSpec,
          rows: rawVisibleRows,
        })
        const limit = Number.isFinite(params?.limit) ? params.limit : 20
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Inspected ${visibleCount} visible rows and returned a sample.`,
            rationale: 'Visible-row evidence was requested for the target widget.',
          }),
        })
        return {
          result: {
            ref: targetWidget.ref,
            dataRef,
            visibleCount,
            rows: visibleRows.slice(0, limit),
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
          getFinalWorkspaceSnapshot: (options = {}) => readSnapshotFromStore(
            this.store,
            options?.stateId || params?.stateId || null,
            options,
          ),
          evaluateLinkPropagation: (options) => this.coordinationEngine?.evaluatePropagation?.(options) || null,
          actionName: params?.actionName || null,
          actionParams: params?.actionParams || {},
          stateId: params?.stateId || null,
          refs: params?.refs || [],
          targetRef: call?.target?.widgetRef || null,
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
              : [
                `Missing refs: ${verification.missingRefs.length}.`,
                `Propagation ok: ${verification.linkPropagation.every((entry) => entry.ok)}.`,
                verification?.semanticVerification?.ok === false ? verification.semanticVerification.summary : null,
              ].filter(Boolean).join(' '),
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

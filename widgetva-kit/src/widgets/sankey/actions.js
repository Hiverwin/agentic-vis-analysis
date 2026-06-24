import { makeActionDescriptor, makeHighlightEffect, makeSelectionEffect } from '../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../../adapters/widgets/shared/selectionResult.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function findNamedDataSource(spec, name) {
  const data = Array.isArray(spec?.data) ? spec.data : []
  const index = data.findIndex((entry) => entry && typeof entry === 'object' && entry.name === name)
  if (index < 0) return { index: -1, values: null }
  return {
    index,
    values: Array.isArray(data[index]?.values) ? data[index].values : null,
  }
}

function findNamedMark(spec, name) {
  const marks = Array.isArray(spec?.marks) ? spec.marks : []
  for (const mark of marks) {
    if (mark?.name === name) return mark
    if (mark?.type === 'group' && Array.isArray(mark.marks)) {
      const nested = mark.marks.find((entry) => entry?.name === name)
      if (nested) return nested
    }
  }
  return null
}

function findNamedSignal(spec, name) {
  const signals = Array.isArray(spec?.signals) ? spec.signals : []
  const index = signals.findIndex((entry) => entry && typeof entry === 'object' && entry.name === name)
  if (index < 0) return { index: -1, signal: null }
  return {
    index,
    signal: signals[index],
  }
}

function computeNodeFlows(links) {
  const flows = new Map()
  const ensure = (name) => {
    if (!flows.has(name)) {
      flows.set(name, { inflow: 0, outflow: 0, total: 0 })
    }
    return flows.get(name)
  }
  for (const link of Array.isArray(links) ? links : []) {
    if (!link || typeof link !== 'object') continue
    const source = link.source
    const target = link.target
    const value = Number(link.value || 0)
    const sourceEntry = ensure(source)
    const targetEntry = ensure(target)
    sourceEntry.outflow += value
    targetEntry.inflow += value
  }
  for (const entry of flows.values()) {
    entry.total = Math.max(entry.inflow, entry.outflow)
  }
  return flows
}

export function buildSankeyActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['sankey']
  return [
    makeActionDescriptor({
      name: 'sankey.focusFlow',
      title: 'Focus Sankey flow',
      description: 'Focus one or more flow categories or nodes in the current Sankey view.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          values: { type: 'array', items: {}, minItems: 1 },
        },
        required: ['field', 'values'],
      },
      postconditions: [
        {
          description: 'The active selection should contain the requested flow or node categories.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.focusFlow requires a valid sankey target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a categorical selection over Sankey flow nodes or links.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeHighlightEffect(ref, 'Linked widgets may highlight or filter the selected flow categories.')),
      ],
      examples: [
        {
          userGoal: 'Focus a subset of flows before investigating bottlenecks.',
          params: { field: 'source', values: ['A'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.selectAggregateNode',
      title: 'Select a collapsed Sankey aggregate node',
      description: 'Select one collapsed aggregate node by aggregate name so downstream context can focus that temporary group even when it does not map to row-level predicates.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          aggregateName: { type: 'string' },
        },
        required: ['aggregateName'],
      },
      postconditions: [
        {
          description: 'The active selection should preserve the requested aggregateName even when no row-level predicates are available.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.selectAggregateNode requires a valid sankey target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates an aggregate-node selection over one collapsed Sankey group.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeHighlightEffect(ref, 'Linked widgets may use the selected Sankey aggregate as a focused comparison context.')),
      ],
      examples: [
        {
          userGoal: 'Hold one collapsed aggregate group as the current focus before deciding whether to re-expand it.',
          params: { aggregateName: 'collapsed:1:other' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.filterFlow',
      title: 'Filter Sankey flow by threshold',
      description: 'Keep only links at or above a minimum flow value, preferably by updating the Sankey threshold signal when one exists.',
      primitive: 'filter',
      category: 'dataTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'transforms' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          minValue: { type: 'number' },
        },
        required: ['minValue'],
      },
      postconditions: [
        {
          description: 'The Sankey threshold signal should reflect the requested minimum flow, or rawLinks/nodeConfig should be filtered to links at or above it.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace and the current Sankey view has rawLinks.',
          failureMessage: 'sankey.filterFlow requires a valid sankey target widget with rawLinks.',
        },
      ],
      examples: [
        {
          userGoal: 'Hide tiny flows so the main pathways stand out more clearly.',
          params: { minValue: 20 },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.collapseNodes',
      title: 'Collapse Sankey nodes',
      description: 'Collapse multiple nodes into one aggregate node by rewriting the raw link list and node configuration in the current Sankey view.',
      primitive: 'aggregate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          aggregateName: { type: 'string' },
        },
        required: ['nodes'],
      },
      postconditions: [
        {
          description: 'The requested nodes should be replaced by one aggregate node, and rawLinks/nodeConfig should reflect the new topology.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.collapseNodes requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Merge several low-signal source nodes into one aggregate before comparing downstream flow structure.',
          params: { nodes: ['A', 'B'], aggregateName: 'Other Sources' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.expandNode',
      title: 'Expand a collapsed Sankey node',
      description: 'Restore the original nodes and links for one previously collapsed aggregate node using the saved Sankey structural state.',
      primitive: 'navigate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          aggregateName: { type: 'string' },
        },
        required: ['aggregateName'],
      },
      postconditions: [
        {
          description: 'The aggregate node should be replaced by its original nodes and links, and the saved collapsed-group entry should be removed.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.expandNode requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Re-expand one aggregate group after an earlier structural simplification pass.',
          params: { aggregateName: 'Other Sources' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.highlightPath',
      title: 'Highlight a Sankey path',
      description: 'Visually emphasize a multi-step path by increasing opacity for edges and nodes on the path and dimming unrelated structure.',
      primitive: 'highlight',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          path: {
            oneOf: [
              { type: 'string' },
              {
                type: 'array',
                minItems: 2,
                items: { type: 'string' },
              },
            ],
          },
        },
        required: ['path'],
      },
      postconditions: [
        {
          description: 'The edge and node marks should contain path-sensitive opacity/stroke updates that emphasize the requested path and dim unrelated structure.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.highlightPath requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Trace one conversion route through the Sankey graph while dimming everything else.',
          params: { path: ['A', 'B', 'C'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.traceNode',
      title: 'Trace Sankey node connections',
      description: 'Highlight all edges directly connected to one node and visually emphasize that node while dimming unrelated structure.',
      primitive: 'focus',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          nodeName: { type: 'string' },
        },
        required: ['nodeName'],
      },
      postconditions: [
        {
          description: 'Edges touching the requested node should remain prominent while unrelated edges and nodes are dimmed, or the selectedNode signal should be updated when the provider exposes it.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.traceNode requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Trace all direct inflows and outflows for one node before deciding whether to collapse or reorder the layer.',
          params: { nodeName: 'Checkout' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.colorFlows',
      title: 'Color Sankey flows connected to nodes',
      description: 'Recolor all edges directly connected to one or more nodes while leaving the unrelated edge color encoding as a fallback.',
      primitive: 'reencode',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          color: { type: 'string' },
        },
        required: ['nodes'],
      },
      postconditions: [
        {
          description: 'Edges connected to the requested nodes should be recolored while unrelated edges still resolve through the prior fill encoding or a fallback color scale expression.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.colorFlows requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Color all flows touching one or more nodes before presenting a focused Sankey story.',
          params: { nodes: ['Checkout'], color: '#e74c3c' },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.reorderNodesInLayer',
      title: 'Reorder Sankey nodes in one layer',
      description: 'Rewrite node order values for one Sankey depth layer using an explicit top-to-bottom node order.',
      primitive: 'reencode',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          depth: { type: 'number' },
          order: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
        },
        required: ['depth', 'order'],
      },
      postconditions: [
        {
          description: 'The nodeConfig entries at the requested depth should have updated order values reflecting the requested top-to-bottom sequence.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.reorderNodesInLayer requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Reorder one Sankey layer to make important nodes appear first from top to bottom.',
          params: { depth: 0, order: ['C', 'A', 'B'] },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'sankey.autoCollapseByRank',
      title: 'Auto-collapse Sankey nodes by rank',
      description: 'Keep only the top-N nodes per Sankey layer by flow volume and collapse the remainder into layer-specific aggregate nodes.',
      primitive: 'aggregate',
      category: 'viewTransform',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'view' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          topN: { type: 'number' },
        },
        required: ['topN'],
      },
      postconditions: [
        {
          description: 'Each layer should keep only the top-N nodes by total flow while lower-ranked nodes are replaced by per-layer aggregate nodes in rawLinks/nodeConfig.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid sankey widget in the current workspace.',
          failureMessage: 'sankey.autoCollapseByRank requires a valid sankey target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Simplify a large Sankey by keeping only the most important nodes in each layer.',
          params: { topN: 2 },
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerSankeyActions(actionExecutor) {
  if (!actionExecutor.has('sankey.focusFlow')) {
    actionExecutor.register(
      { name: 'sankey.focusFlow' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
        })
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('sankey.focusFlow requires a sankey target, field, and one or more values.')
        }

        const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length
        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field,
          values,
          predicates: [{ field, op: 'in', value: values }],
          count: matchedCount,
          summary: `${field}: ${values.join(', ')}`,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated Sankey selection state.',
            'Read linked widgets or feedback to confirm focused flow propagation.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('sankey.selectAggregateNode')) {
    actionExecutor.register(
      { name: 'sankey.selectAggregateNode' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.selectAggregateNode requires a valid sankey target widget.',
        })
        const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
          ? params.aggregateName.trim()
          : null
        if (!targetWidget || !aggregateName) {
          throw new Error('sankey.selectAggregateNode requires a sankey target and an aggregateName.')
        }

        const nextState = ctx.commitSelection({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field: 'aggregateName',
          values: [aggregateName],
          predicates: [],
          count: 1,
          summary: `aggregateName: ${aggregateName}`,
          aggregateName,
        })

        return buildSelectionActionResult({
          ctx,
          nextState,
          selectedCount: 1,
          verificationHints: [
            'Read the updated Sankey selection state and confirm the aggregateName is preserved on the active selection.',
            'Read the coordination state to verify the aggregate selection became the current focused Sankey context.',
          ],
        })
      },
    )
  }

  if (!actionExecutor.has('sankey.filterFlow')) {
    actionExecutor.register(
      { name: 'sankey.filterFlow' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.filterFlow requires a valid sankey target widget.',
        })
        const minValue = Number(params.minValue)
        if (!targetWidget || !Number.isFinite(minValue)) {
          throw new Error('sankey.filterFlow requires a sankey target and a finite minValue.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for sankey flow filtering.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          if (rawLinksSource.index < 0 || !rawLinksSource.values) {
            throw new Error('sankey.filterFlow requires a rawLinks data source.')
          }

          const survivingLinks = rawLinksSource.values.filter((link) => Number(link?.value || 0) >= minValue)
          if (survivingLinks.length === 0) {
            throw new Error(`sankey.filterFlow found no links with value >= ${minValue}.`)
          }

          const thresholdSignal = findNamedSignal(nextSpec, 'threshold')
          if (thresholdSignal.index >= 0 && thresholdSignal.signal) {
            nextSpec.signals[thresholdSignal.index] = {
              ...thresholdSignal.signal,
              value: minValue,
              ...(thresholdSignal.signal.bind && typeof thresholdSignal.signal.bind === 'object'
                ? {
                    bind: {
                      ...thresholdSignal.signal.bind,
                      ...(Number.isFinite(thresholdSignal.signal.bind.max) && minValue > thresholdSignal.signal.bind.max
                        ? { max: minValue * 1.5 }
                        : {}),
                    },
                  }
                : {}),
            }
            nextSpec._sankey_filter_state = {
              mode: 'threshold',
              min_value: minValue,
              source_action: 'sankey.filterFlow',
            }
            return nextSpec
          }

          nextSpec.data[rawLinksSource.index].values = survivingLinks
          const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
          if (nodeConfigSource.index >= 0 && nodeConfigSource.values) {
            const usedNodes = new Set()
            survivingLinks.forEach((link) => {
              if (typeof link?.source === 'string') usedNodes.add(link.source)
              if (typeof link?.target === 'string') usedNodes.add(link.target)
            })
            nextSpec.data[nodeConfigSource.index].values = nodeConfigSource.values.filter((node) => usedNodes.has(node?.name))
          }
          nextSpec._sankey_filter_state = {
            mode: 'threshold',
            min_value: minValue,
            source_action: 'sankey.filterFlow',
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            minValue,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the threshold signal or rawLinks data now reflect the requested minimum flow.',
            'Read the target widget view state to confirm low-value links no longer participate in the visible Sankey structure.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.collapseNodes')) {
    actionExecutor.register(
      { name: 'sankey.collapseNodes' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.collapseNodes requires a valid sankey target widget.',
        })
        const nodes = Array.isArray(params.nodes)
          ? params.nodes.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : []
        const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
          ? params.aggregateName
          : 'Other'
        if (!targetWidget || nodes.length === 0) {
          throw new Error('sankey.collapseNodes requires a sankey target and one or more node names.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for collapsing Sankey nodes.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
          if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) {
            throw new Error('sankey.collapseNodes requires rawLinks and nodeConfig data sources.')
          }

          const collapseSet = new Set(nodes)
          const existingNames = new Set(nodeConfigSource.values.map((node) => node?.name).filter((name) => typeof name === 'string'))
          const missing = nodes.filter((name) => !existingNames.has(name))
          if (missing.length > 0) {
            throw new Error(`sankey.collapseNodes cannot find node(s): ${missing.join(', ')}`)
          }

          if (!nextSpec._sankey_state || typeof nextSpec._sankey_state !== 'object') {
            nextSpec._sankey_state = {
              original_nodes: cloneValue(nodeConfigSource.values),
              original_links: cloneValue(rawLinksSource.values),
              collapsed_groups: {},
            }
          }
          if (!nextSpec._sankey_state.collapsed_groups || typeof nextSpec._sankey_state.collapsed_groups !== 'object') {
            nextSpec._sankey_state.collapsed_groups = {}
          }
          nextSpec._sankey_state.collapsed_groups[aggregateName] = [...nodes]
          nextSpec._sankey_aggregate_state = {
            mode: 'collapseNodes',
            aggregate_name: aggregateName,
            collapsed_nodes: [...nodes],
          }

          let collapseDepth = 0
          let maxOrder = 0
          for (const node of nodeConfigSource.values) {
            if (!node || typeof node !== 'object') continue
            if (collapseSet.has(node.name)) {
              collapseDepth = typeof node.depth === 'number' ? node.depth : collapseDepth
            }
            if ((typeof node.depth === 'number' ? node.depth : 0) === collapseDepth) {
              maxOrder = Math.max(maxOrder, typeof node.order === 'number' ? node.order : 0)
            }
          }

          const newNodes = nodeConfigSource.values.filter((node) => !collapseSet.has(node?.name))
          newNodes.push({
            name: aggregateName,
            depth: collapseDepth,
            order: maxOrder + 1,
            _is_aggregate: true,
            _collapsed_nodes: [...nodes],
          })

          const linkAgg = new Map()
          for (const link of rawLinksSource.values) {
            if (!link || typeof link !== 'object') continue
            const src = link.source
            const tgt = link.target
            const value = Number(link.value || 0)
            const newSrc = collapseSet.has(src) ? aggregateName : src
            const newTgt = collapseSet.has(tgt) ? aggregateName : tgt
            if (newSrc === aggregateName && newTgt === aggregateName) continue
            const key = `${newSrc}-->${newTgt}`
            linkAgg.set(key, {
              source: newSrc,
              target: newTgt,
              value: (linkAgg.get(key)?.value || 0) + value,
            })
          }

          nextSpec.data[nodeConfigSource.index].values = newNodes
          nextSpec.data[rawLinksSource.index].values = [...linkAgg.values()]
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            nodes,
            aggregateName,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify rawLinks and nodeConfig now include the aggregate node and collapsed topology.',
            'Read the target widget view state to confirm the original Sankey nodes and links were preserved in _sankey_state for later expansion.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.expandNode')) {
    actionExecutor.register(
      { name: 'sankey.expandNode' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.expandNode requires a valid sankey target widget.',
        })
        const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
          ? params.aggregateName
          : null
        if (!targetWidget || !aggregateName) {
          throw new Error('sankey.expandNode requires a sankey target and an aggregateName.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for expanding Sankey nodes.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
          if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) {
            throw new Error('sankey.expandNode requires rawLinks and nodeConfig data sources.')
          }

          const sankeyState = nextSpec._sankey_state && typeof nextSpec._sankey_state === 'object'
            ? nextSpec._sankey_state
            : null
          const collapsedGroups = sankeyState?.collapsed_groups && typeof sankeyState.collapsed_groups === 'object'
            ? sankeyState.collapsed_groups
            : null
          const originalNodes = Array.isArray(sankeyState?.original_nodes) ? sankeyState.original_nodes : null
          const originalLinks = Array.isArray(sankeyState?.original_links) ? sankeyState.original_links : null
          if (!collapsedGroups || !originalNodes || !originalLinks) {
            throw new Error('sankey.expandNode requires saved _sankey_state with original nodes, links, and collapsed groups.')
          }
          if (!Array.isArray(collapsedGroups[aggregateName])) {
            throw new Error(`sankey.expandNode cannot find collapsed group "${aggregateName}".`)
          }

          const collapsedNodeNames = new Set(collapsedGroups[aggregateName])
          const newNodes = nodeConfigSource.values.filter((node) => node?.name !== aggregateName)
          for (const originalNode of originalNodes) {
            if (collapsedNodeNames.has(originalNode?.name)) {
              newNodes.push(cloneValue(originalNode))
            }
          }

          const currentNodeNames = new Set(newNodes.map((node) => node?.name).filter((name) => typeof name === 'string'))
          const restoredLinks = []
          for (const originalLink of originalLinks) {
            const src = originalLink?.source
            const tgt = originalLink?.target
            if (currentNodeNames.has(src) && currentNodeNames.has(tgt)) {
              restoredLinks.push(cloneValue(originalLink))
            }
          }

          for (const link of rawLinksSource.values) {
            const src = link?.source
            const tgt = link?.target
            if (src === aggregateName || tgt === aggregateName) continue
            if (collapsedNodeNames.has(src) || collapsedNodeNames.has(tgt)) continue
            const exists = restoredLinks.some((existing) => existing?.source === src && existing?.target === tgt)
            if (!exists) {
              restoredLinks.push(cloneValue(link))
            }
          }

          nextSpec.data[nodeConfigSource.index].values = newNodes
          nextSpec.data[rawLinksSource.index].values = restoredLinks
          delete nextSpec._sankey_state.collapsed_groups[aggregateName]
          nextSpec._navigation_state = {
            mode: 'expandNode',
            sourceAction: 'sankey.expandNode',
            aggregateName,
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            aggregateName,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the aggregate node has been replaced by its original nodes and links.',
            'Read the target widget view state to confirm the corresponding collapsed-group entry was removed from _sankey_state.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.highlightPath')) {
    actionExecutor.register(
      { name: 'sankey.highlightPath' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.highlightPath requires a valid sankey target widget.',
        })
        const path = Array.isArray(params.path)
          ? params.path.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : (typeof params.path === 'string' && params.path.trim().length > 0
              ? params.path.split(',').map((value) => value.trim()).filter((value) => value.length > 0)
              : [])
        if (!targetWidget || path.length < 2) {
          throw new Error('sankey.highlightPath requires a sankey target and a path with at least two nodes.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for highlighting a Sankey path.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          if (rawLinksSource.index < 0 || !rawLinksSource.values) {
            throw new Error('sankey.highlightPath requires a rawLinks data source.')
          }

          const linkSet = new Set(rawLinksSource.values.map((link) => `${link?.source}-->${link?.target}`))
          const highlightEdges = []
          for (let index = 0; index < path.length - 1; index += 1) {
            const key = `${path[index]}-->${path[index + 1]}`
            if (linkSet.has(key)) {
              highlightEdges.push([path[index], path[index + 1]])
            }
          }
          if (highlightEdges.length === 0) {
            throw new Error('sankey.highlightPath could not find any valid edges along the requested path.')
          }

          const edgeMark = findNamedMark(nextSpec, 'edgeMark')
          const nodeMark = findNamedMark(nextSpec, 'nodeRect')
          const edgeConditions = highlightEdges.map(([source, target]) => `(datum.source === '${source}' && datum.target === '${target}')`)
          const nodeConditions = [...new Set(path)].map((node) => `datum.name === '${node}'`)
          if (edgeMark) {
            const update = (((edgeMark.encode ||= {}).update) ||= {})
            update.fillOpacity = { signal: `(${edgeConditions.join(' || ')}) ? 0.75 : 0.06` }
            update.strokeOpacity = { signal: `(${edgeConditions.join(' || ')}) ? 0.5 : 0.02` }
          }
          if (nodeMark) {
            const update = (((nodeMark.encode ||= {}).update) ||= {})
            update.fillOpacity = { signal: `(${nodeConditions.join(' || ')}) ? 1.0 : 0.15` }
            update.strokeWidth = { signal: `(${nodeConditions.join(' || ')}) ? 2.5 : 0.5` }
          }

          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            path,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the Sankey edge and node marks now contain path-sensitive opacity and stroke updates.',
            'Read the target widget view state to confirm the requested path remains prominent while unrelated edges and nodes are dimmed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.traceNode')) {
    actionExecutor.register(
      { name: 'sankey.traceNode' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.traceNode requires a valid sankey target widget.',
        })
        const nodeName = typeof params.nodeName === 'string' && params.nodeName.trim().length > 0
          ? params.nodeName.trim()
          : null
        if (!targetWidget || !nodeName) {
          throw new Error('sankey.traceNode requires a sankey target and a nodeName.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for tracing a Sankey node.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          if (rawLinksSource.index < 0 || !rawLinksSource.values) {
            throw new Error('sankey.traceNode requires a rawLinks data source.')
          }

          const nodeExists = rawLinksSource.values.some((link) => link?.source === nodeName || link?.target === nodeName)
          if (!nodeExists) {
            throw new Error(`sankey.traceNode cannot find node "${nodeName}" in rawLinks.`)
          }

          const selectedNodeSignal = findNamedSignal(nextSpec, 'selectedNode')
          if (selectedNodeSignal.index >= 0 && selectedNodeSignal.signal) {
            nextSpec.signals[selectedNodeSignal.index] = {
              ...selectedNodeSignal.signal,
              value: nodeName,
            }
            nextSpec._sankey_focus_state = {
              node_name: nodeName,
            }
            return nextSpec
          }

          const edgeMark = findNamedMark(nextSpec, 'edgeMark')
          const nodeMark = findNamedMark(nextSpec, 'nodeRect')
          if (edgeMark) {
            const update = (((edgeMark.encode ||= {}).update) ||= {})
            update.fillOpacity = {
              signal: `datum.source === '${nodeName}' || datum.target === '${nodeName}' ? 0.75 : 0.08`,
            }
          }
          if (nodeMark) {
            const update = (((nodeMark.encode ||= {}).update) ||= {})
            update.fillOpacity = {
              signal: `datum.name === '${nodeName}' ? 1.0 : 0.2`,
            }
          }

          nextSpec._sankey_focus_state = {
            node_name: nodeName,
          }

          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            nodeName,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the selectedNode signal or mark encodings now target the requested node and its directly connected flows.',
            'Read the target widget view state to confirm unrelated Sankey edges and nodes are dimmed relative to the traced node.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.colorFlows')) {
    actionExecutor.register(
      { name: 'sankey.colorFlows' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.colorFlows requires a valid sankey target widget.',
        })
        const nodes = Array.isArray(params.nodes)
          ? params.nodes.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : []
        const color = typeof params.color === 'string' && params.color.trim().length > 0
          ? params.color.trim()
          : '#e74c3c'
        if (!targetWidget || nodes.length === 0) {
          throw new Error('sankey.colorFlows requires a sankey target and one or more node names.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for coloring Sankey flows.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          if (rawLinksSource.index < 0 || !rawLinksSource.values) {
            throw new Error('sankey.colorFlows requires a rawLinks data source.')
          }

          const nodesSet = new Set(nodes)
          const coloredEdges = rawLinksSource.values
            .filter((link) => link && typeof link === 'object' && (nodesSet.has(link.source) || nodesSet.has(link.target)))
            .map((link) => [link.source, link.target])
          if (coloredEdges.length === 0) {
            throw new Error(`sankey.colorFlows cannot find any flows connected to nodes: ${nodes.join(', ')}`)
          }

          const edgeMark = findNamedMark(nextSpec, 'edgeMark')
          if (!edgeMark) {
            throw new Error('sankey.colorFlows requires an edgeMark in the current Sankey spec.')
          }

          const update = (((edgeMark.encode ||= {}).update) ||= {})
          const originalFill = update.fill
          let fallback = "scale('color', datum.source)"
          if (originalFill && typeof originalFill === 'object' && !Array.isArray(originalFill)) {
            if (typeof originalFill.scale === 'string' && typeof originalFill.field === 'string') {
              fallback = `scale('${originalFill.scale}', datum.${originalFill.field})`
            } else if (typeof originalFill.signal === 'string' && originalFill.signal.trim().length > 0) {
              fallback = `(${originalFill.signal})`
            } else if (Object.prototype.hasOwnProperty.call(originalFill, 'value')) {
              fallback = `'${originalFill.value}'`
            }
          }

          const isColored = coloredEdges
            .map(([source, target]) => `(datum.source === '${source}' && datum.target === '${target}')`)
            .join(' || ')

          update.fill = {
            signal: `(${isColored}) ? '${color}' : ${fallback}`,
          }
          nextSpec._sankey_reencode_state = {
            mode: 'colorFlows',
            nodes: [...nodes],
            color,
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            nodes,
            color,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the Sankey edgeMark fill encoding now recolors flows connected to the requested nodes.',
            'Read the target widget view state to confirm unrelated edge colors still resolve through the prior fill encoding fallback.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.reorderNodesInLayer')) {
    actionExecutor.register(
      { name: 'sankey.reorderNodesInLayer' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.reorderNodesInLayer requires a valid sankey target widget.',
        })
        const depth = typeof params.depth === 'number' && Number.isFinite(params.depth) ? params.depth : null
        const order = Array.isArray(params.order)
          ? params.order.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : []
        if (!targetWidget || depth == null || order.length === 0) {
          throw new Error('sankey.reorderNodesInLayer requires a sankey target, a numeric depth, and a non-empty order list.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for reordering Sankey nodes in one layer.')
          }

          const nextSpec = cloneValue(spec)
          const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
          if (nodeConfigSource.index < 0 || !nodeConfigSource.values) {
            throw new Error('sankey.reorderNodesInLayer requires a nodeConfig data source.')
          }

          const layerNodes = nodeConfigSource.values.filter((node) => Number(node?.depth ?? 0) === depth)
          if (layerNodes.length === 0) {
            throw new Error(`sankey.reorderNodesInLayer cannot find nodes at depth ${depth}.`)
          }

          const orderMap = new Map(order.map((name, index) => [name, index]))
          nextSpec.data[nodeConfigSource.index].values = nodeConfigSource.values.map((node) => {
            if (Number(node?.depth ?? 0) !== depth) return node
            if (!orderMap.has(node?.name)) return node
            return {
              ...node,
              order: orderMap.get(node.name),
            }
          })
          nextSpec._sankey_reencode_state = {
            mode: 'reorderNodesInLayer',
            depth,
            order: [...order],
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            depth,
            order,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the nodeConfig entries at the requested depth now use the requested order values.',
            'Read the target widget view state to confirm the Sankey layer ordering changed without altering the underlying raw link topology.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.autoCollapseByRank')) {
    actionExecutor.register(
      { name: 'sankey.autoCollapseByRank' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'sankey',
          message: 'sankey.autoCollapseByRank requires a valid sankey target widget.',
        })
        const topN = typeof params.topN === 'number' && Number.isFinite(params.topN) ? params.topN : null
        if (!targetWidget || topN == null || topN < 0) {
          throw new Error('sankey.autoCollapseByRank requires a sankey target and a non-negative numeric topN.')
        }

        const nextState = ctx.updateCurrentSpec((spec) => {
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('No active base spec is available for auto-collapsing Sankey nodes by rank.')
          }

          const nextSpec = cloneValue(spec)
          const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
          const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
          if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) {
            throw new Error('sankey.autoCollapseByRank requires rawLinks and nodeConfig data sources.')
          }

          if (!nextSpec._sankey_state || typeof nextSpec._sankey_state !== 'object') {
            nextSpec._sankey_state = {
              original_nodes: cloneValue(nodeConfigSource.values),
              original_links: cloneValue(rawLinksSource.values),
              collapsed_groups: {},
            }
          }
          if (!nextSpec._sankey_state.collapsed_groups || typeof nextSpec._sankey_state.collapsed_groups !== 'object') {
            nextSpec._sankey_state.collapsed_groups = {}
          }

          const nodeFlows = computeNodeFlows(rawLinksSource.values)
          const depthGroups = new Map()
          for (const node of nodeConfigSource.values) {
            const depth = Number(node?.depth ?? 0)
            if (!depthGroups.has(depth)) depthGroups.set(depth, [])
            depthGroups.get(depth).push(node)
          }

          const nodesToKeep = new Set()
          const collapsedByLayer = new Map()
          const nodeToAggregate = new Map()

          for (const [depth, group] of depthGroups.entries()) {
            const sortedGroup = [...group].sort((left, right) => {
              const leftTotal = nodeFlows.get(left?.name)?.total || 0
              const rightTotal = nodeFlows.get(right?.name)?.total || 0
              return rightTotal - leftTotal
            })
            for (const node of sortedGroup.slice(0, topN)) {
              nodesToKeep.add(node?.name)
            }
            const collapsedNames = sortedGroup.slice(topN).map((node) => node?.name).filter((name) => typeof name === 'string')
            if (collapsedNames.length > 0) {
              const aggregateName = `Others (Layer ${depth})`
              collapsedByLayer.set(depth, { aggregateName, collapsedNodes: collapsedNames })
              nextSpec._sankey_state.collapsed_groups[aggregateName] = collapsedNames
              for (const name of collapsedNames) {
                nodeToAggregate.set(name, aggregateName)
              }
            }
          }

          if (collapsedByLayer.size === 0) {
            return nextSpec
          }

          const newNodes = nodeConfigSource.values.filter((node) => nodesToKeep.has(node?.name))
          for (const [depth, info] of collapsedByLayer.entries()) {
            const group = depthGroups.get(depth) || []
            const maxOrder = group.reduce((max, node) => Math.max(max, Number(node?.order ?? 0)), 0)
            newNodes.push({
              name: info.aggregateName,
              depth,
              order: maxOrder + 1,
              _is_aggregate: true,
              _collapsed_nodes: info.collapsedNodes,
            })
          }

          const linkAgg = new Map()
          for (const link of rawLinksSource.values) {
            if (!link || typeof link !== 'object') continue
            const source = nodeToAggregate.get(link.source) || link.source
            const target = nodeToAggregate.get(link.target) || link.target
            const key = `${source}-->${target}`
            linkAgg.set(key, {
              source,
              target,
              value: (linkAgg.get(key)?.value || 0) + Number(link.value || 0),
            })
          }

          nextSpec.data[nodeConfigSource.index].values = newNodes
          nextSpec.data[rawLinksSource.index].values = [...linkAgg.values()]
          nextSpec._sankey_aggregate_state = {
            mode: 'autoCollapseByRank',
            top_n: topN,
            collapsed_groups: [...collapsedByLayer.entries()].map(([depth, info]) => ({
              depth,
              aggregate_name: info.aggregateName,
              collapsed_nodes: [...info.collapsedNodes],
            })),
          }
          return nextSpec
        })

        return {
          nextState,
          result: {
            widgetId: targetWidget.widgetId,
            topN,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify lower-ranked nodes were replaced by per-layer aggregate nodes in rawLinks/nodeConfig.',
            'Read the target widget view state to confirm the original Sankey topology remains preserved in _sankey_state for later restoration.',
          ],
        }
      },
    )
  }
}

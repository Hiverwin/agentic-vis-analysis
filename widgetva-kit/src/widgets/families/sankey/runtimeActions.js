import { buildWidgetSelectionPatch } from '../shared/selectionPatch.js'
import { buildSankeySemanticPatch } from './semanticPatches.js'

function targetWidgetState(targetWidget) {
  return { widgets: { [targetWidget.ref]: targetWidget } }
}

export function registerSankeyActions(actionExecutor) {
  if (!actionExecutor.has('sankey.focusFlow')) {
    actionExecutor.register(
      { name: 'sankey.focusFlow' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('sankey.focusFlow requires a sankey target, field, and one or more values.')
        }

        const visibleRows = ctx.readRows(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length
        const selection = {
          selection_id: 'flow',
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field,
          values,
          predicates: [{ field, op: 'in', value: values }],
          count: matchedCount,
          summary: `${field}: ${values.join(', ')}`,
        }

        return {
          patch: buildWidgetSelectionPatch({
            targetWidget,
            selection,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: matchedCount,
          },
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated Sankey selection state.',
            'Read linked widgets or feedback to confirm focused flow propagation.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.selectAggregateNode')) {
    actionExecutor.register(
      { name: 'sankey.selectAggregateNode' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
          ? params.aggregateName.trim()
          : null
        if (!targetWidget || !aggregateName) {
          throw new Error('sankey.selectAggregateNode requires a sankey target and an aggregateName.')
        }

        const selection = {
          selection_id: 'node',
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'category',
          field: 'aggregateName',
          values: [aggregateName],
          predicates: [{ field: 'aggregateName', op: 'equals', value: aggregateName }],
          count: 1,
          summary: `aggregateName: ${aggregateName}`,
          aggregateName,
        }

        return {
          patch: buildWidgetSelectionPatch({
            targetWidget,
            selection,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: 1,
          },
          selectedCount: 1,
          verificationHints: [
            'Read the updated Sankey selection state and confirm the aggregateName is preserved on the active selection.',
            'Read the coordination state to verify the aggregate selection became the current focused Sankey context.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('sankey.filterFlow')) {
    actionExecutor.register(
      { name: 'sankey.filterFlow' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const minValue = Number(params.minValue)
        if (!targetWidget || !Number.isFinite(minValue)) {
          throw new Error('sankey.filterFlow requires a sankey target and a finite minValue.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.filterFlow',
            transformKind: 'filter',
            analysisKey: 'flowFilter',
            viewKey: 'reencode',
            viewState: {
              mode: 'flowFilter',
              minValue,
            },
            spec: {
              minValue,
              predicates: [{ field: 'value', op: 'gte', value: minValue }],
            },
          }),
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const nodes = Array.isArray(params.nodes)
          ? params.nodes.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : []
        const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
          ? params.aggregateName
          : 'Other'
        if (!targetWidget || nodes.length === 0) {
          throw new Error('sankey.collapseNodes requires a sankey target and one or more node names.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.collapseNodes',
            transformKind: 'aggregate',
            analysisKey: 'nodeCollapse',
            viewKey: 'addRemove',
            viewState: {
              mode: 'nodeCollapse',
              nodes,
              aggregateName,
            },
            spec: {
              nodes,
              aggregateName,
            },
          }),
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
          ? params.aggregateName
          : null
        if (!targetWidget || !aggregateName) {
          throw new Error('sankey.expandNode requires a sankey target and an aggregateName.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.expandNode',
            transformKind: 'derive',
            analysisKey: 'nodeExpansion',
            viewKey: 'addRemove',
            viewState: {
              mode: 'nodeExpansion',
              aggregateName,
            },
            spec: {
              aggregateName,
            },
            clearActionName: 'sankey.collapseNodes',
          }),
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const path = Array.isArray(params.path)
          ? params.path.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : (typeof params.path === 'string' && params.path.trim().length > 0
              ? params.path.split(',').map((value) => value.trim()).filter((value) => value.length > 0)
              : [])
        if (!targetWidget || path.length < 2) {
          throw new Error('sankey.highlightPath requires a sankey target and a path with at least two nodes.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.highlightPath',
            transformKind: 'derive',
            analysisKey: 'pathHighlight',
            viewKey: 'highlight',
            viewState: {
              mode: 'pathHighlight',
              path,
            },
            spec: {
              path,
              nodes: path,
            },
          }),
          providerParams: {
            path,
            nodes: path,
          },
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const nodeName = typeof params.nodeName === 'string' && params.nodeName.trim().length > 0
          ? params.nodeName.trim()
          : null
        if (!targetWidget || !nodeName) {
          throw new Error('sankey.traceNode requires a sankey target and a nodeName.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.traceNode',
            transformKind: 'derive',
            analysisKey: 'nodeTrace',
            viewKey: 'highlight',
            viewState: {
              mode: 'nodeTrace',
              nodeName,
            },
            spec: {
              nodeName,
            },
          }),
          providerParams: {
            node: nodeName,
            nodeName,
          },
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const nodes = Array.isArray(params.nodes)
          ? params.nodes.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : []
        const color = typeof params.color === 'string' && params.color.trim().length > 0
          ? params.color.trim()
          : '#e74c3c'
        if (!targetWidget || nodes.length === 0) {
          throw new Error('sankey.colorFlows requires a sankey target and one or more node names.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.colorFlows',
            transformKind: 'reencode',
            analysisKey: 'flowColor',
            viewKey: 'reencode',
            viewState: {
              mode: 'flowColor',
              nodes,
              color,
            },
            spec: {
              nodes,
              color,
            },
          }),
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const depth = typeof params.depth === 'number' && Number.isFinite(params.depth) ? params.depth : null
        const order = Array.isArray(params.order)
          ? params.order.filter((value) => typeof value === 'string' && value.trim().length > 0)
          : []
        if (!targetWidget || depth == null || order.length === 0) {
          throw new Error('sankey.reorderNodesInLayer requires a sankey target, a numeric depth, and a non-empty order list.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.reorderNodesInLayer',
            transformKind: 'reencode',
            analysisKey: 'nodeLayerOrder',
            viewKey: 'reencode',
            viewState: {
              mode: 'nodeLayerOrder',
              depth,
              order,
            },
            spec: {
              depth,
              order,
            },
          }),
          affectedRefs: [targetWidget.ref],
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
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const topN = typeof params.topN === 'number' && Number.isFinite(params.topN) ? params.topN : null
        if (!targetWidget || topN == null || topN < 0) {
          throw new Error('sankey.autoCollapseByRank requires a sankey target and a non-negative numeric topN.')
        }

        return {
          patch: buildSankeySemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'sankey.autoCollapseByRank',
            transformKind: 'aggregate',
            analysisKey: 'autoCollapse',
            viewKey: 'addRemove',
            viewState: {
              mode: 'autoCollapseByRank',
              topN,
            },
            spec: {
              topN,
            },
          }),
          affectedRefs: [targetWidget.ref],
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

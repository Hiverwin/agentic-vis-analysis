import { createProviderFamilyAdapter } from '../../../widgetva-kit/src/adapters/widgetFamilies/index.js'
import { createWidgetInstance } from '../../../widgetva-kit/src/widgets/widgetInstance.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function createDemoHostBridge({ sessionId, baselineSpec, currentSpecRef }) {
  return {
    subscribe: () => () => {},
    readSessionId: () => sessionId,
    readBaselineSpec: () => clone(baselineSpec),
    readCurrentSpec: () => clone(currentSpecRef.current),
    writeCurrentSpec(nextSpec) {
      currentSpecRef.current = clone(nextSpec)
    },
    readWorkspaceSpec: () => null,
    readPlanningRequest: () => null,
    readRunMode: () => 'goal_oriented',
    readUserIntent: () => 'Demonstrate single-widget structured actions on a gallery visualization.',
    readCurrentSelection: () => null,
    readCurrentSelections: () => ({}),
    readFocusedWidgetRef: () => null,
    readComparisonTargets: () => [],
    readWorkspaceAnnotations: () => [],
  }
}

export async function mountSingleWidgetDemo({
  provider,
  kind,
  spec,
  view,
  surface = null,
  sessionId = `demo-${provider}-${kind}`,
} = {}) {
  const baselineSpec = clone(spec)
  const currentSpecRef = { current: clone(spec) }
  const widgetAdapter = createProviderFamilyAdapter(kind, provider)
  const widget = createWidgetInstance({
    widgetAdapter,
    spec: baselineSpec,
    runtimeOptions: {
      hostBridge: createDemoHostBridge({
        sessionId,
        baselineSpec,
        currentSpecRef,
      }),
    },
  })

  await widget.mount({
    view,
    ...(surface ? { surface } : {}),
  })

  return {
    widget,
    widgetAdapter,
    getCurrentSpec() {
      return clone(currentSpecRef.current)
    },
    describeAgentContract() {
      return widget.describeAgentContract()
    },
    dispose() {
      widget.dispose()
    },
  }
}

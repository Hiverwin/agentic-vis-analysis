import { clearOfficialPageRuntime } from './officialPageRuntimeManager.js'
import { clearOfficialPageAgentRuntime } from './officialPageRuntimeBindings.js'

export async function clearOfficialPageBootstrapRuntime({
  entry,
  root,
  capturePreviousState = false,
  preserveRecoverableState = false,
  clearWidgetVA = false,
  clearExtraBindings,
  resetEntry,
} = {}) {
  await clearOfficialPageRuntime(entry, {
    capturePreviousState,
    preserveRecoverableState,
  })

  if (typeof resetEntry === 'function') {
    resetEntry(entry)
  }

  clearOfficialPageAgentRuntime({
    entry,
    root,
    clearWidgetVA,
    clearExtraBindings,
  })
}

export function resetOfficialPageBootstrapBindings({
  entry,
  root,
  clearWidgetVA = false,
  clearExtraBindings,
  resetEntry,
} = {}) {
  if (typeof resetEntry === 'function') {
    resetEntry(entry)
  }

  clearOfficialPageAgentRuntime({
    entry,
    root,
    clearWidgetVA,
    clearExtraBindings,
  })
}

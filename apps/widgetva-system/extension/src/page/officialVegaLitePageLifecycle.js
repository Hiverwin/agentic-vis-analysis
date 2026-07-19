import { clearOfficialPageRuntime } from './officialPageRuntimeManager.js'
import { clearOfficialVegaLitePageAgentRuntime } from './officialVegaLitePageBindings.js'

export async function clearOfficialVegaLitePageBootstrapRuntime({
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

  clearOfficialVegaLitePageAgentRuntime({
    entry,
    root,
    clearWidgetVA,
    clearExtraBindings,
  })
}

export function resetOfficialVegaLitePageBootstrapBindings({
  entry,
  root,
  clearWidgetVA = false,
  clearExtraBindings,
  resetEntry,
} = {}) {
  if (typeof resetEntry === 'function') {
    resetEntry(entry)
  }

  clearOfficialVegaLitePageAgentRuntime({
    entry,
    root,
    clearWidgetVA,
    clearExtraBindings,
  })
}

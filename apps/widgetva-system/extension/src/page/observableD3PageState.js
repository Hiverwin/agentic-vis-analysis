import {
  OBSERVABLE_D3_BOOTSTRAP_ENTRY,
  OBSERVABLE_D3_BOOTSTRAP_KEY,
} from './observableD3Bootstrap.js'

export function ensureObservableD3PageBootstrapEntry(root = window) {
  root[OBSERVABLE_D3_BOOTSTRAP_KEY] = root[OBSERVABLE_D3_BOOTSTRAP_KEY] || {}

  const state = root[OBSERVABLE_D3_BOOTSTRAP_KEY]
  if (!state[OBSERVABLE_D3_BOOTSTRAP_ENTRY] || typeof state[OBSERVABLE_D3_BOOTSTRAP_ENTRY] !== 'object') {
    state[OBSERVABLE_D3_BOOTSTRAP_ENTRY] = {
      provider: 'd3',
      pageType: 'official-observable-notebook',
      status: 'idle',
    }
  }

  return state[OBSERVABLE_D3_BOOTSTRAP_ENTRY]
}

export function markObservableD3BootstrapBooting(root = window) {
  const entry = ensureObservableD3PageBootstrapEntry(root)
  entry.provider = 'd3'
  entry.pageType = 'official-observable-notebook'
  entry.status = 'booting'
  return entry
}

export function recordObservableD3BootstrapError(root = window, error) {
  const entry = ensureObservableD3PageBootstrapEntry(root)
  entry.provider = 'd3'
  entry.pageType = 'official-observable-notebook'
  entry.status = 'error'
  entry.error = {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    ...(error?.code ? { code: error.code } : {}),
  }
  return entry
}

import { useSyncExternalStore } from 'react'

export function useRuntimeStoreVersion(runtime) {
  return useSyncExternalStore(
    (onStoreChange) => runtime?.store?.subscribe?.(onStoreChange) || (() => {}),
    () => runtime?.store?.version || 0,
    () => 0,
  )
}

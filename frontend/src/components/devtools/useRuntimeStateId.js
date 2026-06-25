import { useSyncExternalStore } from 'react'

export function useRuntimeStateId(runtime) {
  return useSyncExternalStore(
    (onStoreChange) => runtime?.store?.subscribe?.(onStoreChange) || (() => {}),
    () => runtime?.store?.state?.stateId || '',
    () => '',
  )
}

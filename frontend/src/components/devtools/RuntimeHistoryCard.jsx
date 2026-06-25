import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  branchFromState,
  branchList,
  jumpToState,
  stateHistoryRead,
} from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { formatRuntimeRef } from './runtimeRefs.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimeHistoryCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [branches, setBranches] = useState([])
  const [jumpingStateId, setJumpingStateId] = useState('')
  const [branchingStateId, setBranchingStateId] = useState('')
  const storeVersion = useSyncExternalStore(
    (onStoreChange) => runtime?.store?.subscribe?.(onStoreChange) || (() => {}),
    () => runtime?.store?.version || 0,
    () => 0,
  )

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setHistory([])
      setBranches([])
      setError('')
      return
    }

    setLoading(true)
    try {
      const [nextHistory, nextBranches] = await Promise.all([
        stateHistoryRead({ limit: 6 }),
        branchList(),
      ])
      setHistory(Array.isArray(nextHistory) ? nextHistory : [])
      setBranches(Array.isArray(nextBranches) ? nextBranches : [])
      setError('')
    } catch (nextError) {
      setHistory([])
      setBranches([])
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'History unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  async function handleJump(stateId) {
    if (!stateId) return
    setJumpingStateId(stateId)
    try {
      await jumpToState({ stateId, actor: 'human' })
      await refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Jump failed'))
    } finally {
      setJumpingStateId('')
    }
  }

  async function handleBranch(stateId) {
    if (!stateId) return
    setBranchingStateId(stateId)
    try {
      await branchFromState({
        stateId,
        actor: 'human',
        branchLabel: `Branch from ${stateId}`,
      })
      await refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Branch failed'))
    } finally {
      setBranchingStateId('')
    }
  }

  return (
    <section
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--accent)' }}>
          {t.runtimeHistory}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeHistoryUnavailable}: {error}
        </div>
      ) : (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeHistoryStates}</strong>{' '}
            {history.length}
          </div>
          {history.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {history.slice(0, 4).map((entry) => (
                <div key={entry.stateId} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {entry.stateId} · {entry.transitionType || 'continue'} · {entry.branchId || 'main'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={jumpingStateId === entry.stateId || branchingStateId === entry.stateId}
                        onClick={() => void handleJump(entry.stateId)}
                      >
                        {jumpingStateId === entry.stateId ? t.loading : t.runtimeHistoryJump}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={branchingStateId === entry.stateId || jumpingStateId === entry.stateId}
                        onClick={() => void handleBranch(entry.stateId)}
                      >
                        {branchingStateId === entry.stateId ? t.loading : t.runtimeHistoryBranch}
                      </button>
                    </div>
                  </div>
                  {(Array.isArray(entry.changedRefs) && entry.changedRefs.length > 0) || (Array.isArray(entry.removedRefs) && entry.removedRefs.length > 0) ? (
                    <div style={{ color: 'var(--text-dim)', paddingLeft: 8 }}>
                      {Array.isArray(entry.changedRefs) && entry.changedRefs.length > 0
                        ? `${t.runtimeHistoryChanged}: ${entry.changedRefs.map((ref) => formatRuntimeRef(ref)).join(', ')}`
                        : null}
                      {Array.isArray(entry.changedRefs) && entry.changedRefs.length > 0 && Array.isArray(entry.removedRefs) && entry.removedRefs.length > 0
                        ? ' · '
                        : null}
                      {Array.isArray(entry.removedRefs) && entry.removedRefs.length > 0
                        ? `${t.runtimeHistoryRemoved}: ${entry.removedRefs.map((ref) => formatRuntimeRef(ref)).join(', ')}`
                        : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeHistoryBranches}</strong>{' '}
            {branches.length}
          </div>
          {branches.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {branches.slice(0, 4).map((branch) => (
                <div key={branch.branchId} style={{ color: 'var(--text-dim)' }}>
                  {branch.branchId} · {branch.label || '-'} · {branch.originStateId || 'root'}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

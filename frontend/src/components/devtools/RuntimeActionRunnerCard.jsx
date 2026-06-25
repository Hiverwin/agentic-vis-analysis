import { useCallback, useEffect, useMemo, useState } from 'react'
import { verifiedActionRun } from 'widgetva-kit/transport-execute'
import { workspaceDescribe } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { useRuntimeStoreVersion } from './useRuntimeStoreVersion.js'
import { formatRuntimeRef } from './runtimeRefs.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

function summarizeLinkPropagation(entries = []) {
  const records = Array.isArray(entries) ? entries : []
  return {
    linkCount: records.reduce((sum, entry) => sum + (Number.isFinite(entry?.linkCount) ? entry.linkCount : 0), 0),
    passedCount: records.reduce((sum, entry) => sum + (Number.isFinite(entry?.passedCount) ? entry.passedCount : 0), 0),
  }
}

export default function RuntimeActionRunnerCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [actions, setActions] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const storeVersion = useRuntimeStoreVersion(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setActions([])
      setSelectedKey('')
      setLastResult(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const description = await workspaceDescribe({
        includeSchemas: false,
        includeExamples: true,
      })
      const nextActions = (Array.isArray(description?.actions) ? description.actions : []).filter(
        (action) => action?.name && action?.examples?.[0]?.params,
      )
      setActions(nextActions)
      setSelectedKey((currentKey) => {
        if (currentKey && nextActions.some((action) => `${action.name}:${action.targetRef || 'workspace'}` === currentKey)) {
          return currentKey
        }
        const fallbackAction = nextActions[0]
        return fallbackAction ? `${fallbackAction.name}:${fallbackAction.targetRef || 'workspace'}` : ''
      })
      setError('')
    } catch (nextError) {
      setActions([])
      setSelectedKey('')
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Action runner unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, storeVersion])

  const selectedAction = useMemo(
    () => actions.find((action) => `${action.name}:${action.targetRef || 'workspace'}` === selectedKey) || null,
    [actions, selectedKey],
  )

  const runSelectedAction = useCallback(async () => {
    if (!selectedAction) return

    const example = selectedAction.examples?.[0] || {}
    setRunning(true)
    try {
      const result = await verifiedActionRun(
        {
          callId: `runtime_action_runner_${Date.now()}`,
          name: selectedAction.name,
          actor: 'human',
          targetRef: selectedAction.targetRef || undefined,
          params: example.params || {},
        },
        {
          includeDeltaSince: true,
        },
      )
      setLastResult(result)
      setError('')
    } catch (nextError) {
      setLastResult(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Action execution failed'))
    } finally {
      setRunning(false)
    }
  }, [selectedAction])

  const actionResult = lastResult?.actionResult || null
  const verification = lastResult?.verification?.result || null
  const propagation = summarizeLinkPropagation(lastResult?.linkPropagation)
  const actionError = actionResult?.error || null
  const recoveryHints = Array.isArray(actionResult?.recoveryHints) ? actionResult.recoveryHints : []
  const expectedPostconditions = Array.isArray(actionResult?.expectedPostconditions) ? actionResult.expectedPostconditions : []
  const verificationHints = Array.isArray(actionResult?.verificationHints) ? actionResult.verificationHints : []

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
          {t.runtimeActionRunner}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading || running}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeActionRunnerUnavailable}: {error}
        </div>
      ) : actions.length > 0 ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerSelect}</strong>
          </div>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              padding: '6px 8px',
            }}
          >
            {actions.slice(0, 12).map((action) => {
              const key = `${action.name}:${action.targetRef || 'workspace'}`
              return (
                <option key={key} value={key}>
                  {action.name} · {action.targetRef || action.scope || 'workspace'}
                </option>
              )
            })}
          </select>

          {selectedAction ? (
            <>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerPrimitive}</strong>{' '}
                {selectedAction.primitive || '-'} · {selectedAction.category || '-'}
              </div>
              {selectedAction.examples?.[0]?.userGoal ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerGoal}</strong>{' '}
                  {selectedAction.examples[0].userGoal}
                </div>
              ) : null}
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerParams}</strong>{' '}
                <code style={{ fontSize: 10 }}>{JSON.stringify(selectedAction.examples?.[0]?.params || {})}</code>
              </div>
              <button className="btn btn-sm" onClick={() => void runSelectedAction()} disabled={running}>
                {running ? t.loading : t.runtimeActionRunnerRun}
              </button>
            </>
          ) : null}

          {actionResult ? (
            <div
              style={{
                display: 'grid',
                gap: 4,
                padding: '6px 8px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerStatus}</strong>{' '}
                {actionResult.ok ? t.runtimeEvidencePass : t.runtimeEvidenceProbe}
              </div>
              {actionError?.code ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerError}</strong>{' '}
                  {actionError.code}
                  {actionError.message ? ` · ${actionError.message}` : ''}
                </div>
              ) : null}
              {recoveryHints.length > 0 ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerRecovery}</strong>{' '}
                  {recoveryHints.slice(0, 2).join(' · ')}
                </div>
              ) : null}
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerState}</strong>{' '}
                {actionResult.stateId || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerUpdatedRefs}</strong>{' '}
                {Array.isArray(actionResult.updatedRefs) && actionResult.updatedRefs.length
                  ? actionResult.updatedRefs.map((ref) => formatRuntimeRef(ref)).join(', ')
                  : '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerVerification}</strong>{' '}
                {verification?.verified ? t.runtimeEvidencePass : t.runtimeEvidenceProbe}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerPropagation}</strong>{' '}
                {propagation.passedCount}/{propagation.linkCount}
              </div>
              {expectedPostconditions.length > 0 ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerPostconditions}</strong>{' '}
                  {expectedPostconditions
                    .slice(0, 2)
                    .map((condition) => condition?.description)
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              ) : null}
              {verificationHints.length ? (
                <div>
                  <strong style={{ color: 'var(--text)' }}>{t.runtimeActionRunnerHints}</strong>{' '}
                  {verificationHints.slice(0, 2).join(' · ')}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeActionRunnerEmpty}
        </div>
      )}
    </section>
  )
}

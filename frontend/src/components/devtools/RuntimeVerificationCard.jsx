import { useCallback, useEffect, useState } from 'react'
import {
  interactionTraceRead,
  perceptionQuery,
} from 'widgetva-kit/transport-execute'
import t from '../../locale.js'
import { useRuntimeStateId } from './useRuntimeStateId.js'
import { formatRuntimeRef, pickRuntimeTargetRef } from './runtimeRefs.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

function summarizePropagation(linkPropagation = []) {
  const entries = Array.isArray(linkPropagation) ? linkPropagation : []
  const linkCount = entries.reduce((sum, entry) => sum + (Number.isFinite(entry?.linkCount) ? entry.linkCount : 0), 0)
  const passedCount = entries.reduce((sum, entry) => sum + (Number.isFinite(entry?.passedCount) ? entry.passedCount : 0), 0)
  return {
    linkCount,
    passedCount,
    ok: entries.every((entry) => entry?.ok !== false),
  }
}

export default function RuntimeVerificationCard({
  runtime,
  currentSelection,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [latestActionRecord, setLatestActionRecord] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const stateId = useRuntimeStateId(runtime)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setLatestActionRecord(null)
      setVerificationResult(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const trace = await interactionTraceRead({ limit: 50 })
      const latestAction = [...(Array.isArray(trace) ? trace : [])]
        .reverse()
        .find((record) => record?.eventKind === 'action' && record?.action?.name)

      if (!latestAction) {
        setLatestActionRecord(null)
        setVerificationResult(null)
        setError('')
        return
      }

      const verification = await perceptionQuery({
        callId: `verify_${latestAction.stateId || Date.now()}`,
        name: 'perception.verifyActionEffect',
        actor: 'human',
        targetRef: pickRuntimeTargetRef({
          targetRef: latestAction?.action?.targetRef,
          affectedRefs: latestAction?.affectedRefs,
        }),
        params: {
          actionName: latestAction.action?.name,
          stateId: latestAction.stateId,
          refs: latestAction.affectedRefs || [],
        },
      })

      setLatestActionRecord(latestAction)
      setVerificationResult(verification)
      setError('')
    } catch (nextError) {
      setLatestActionRecord(null)
      setVerificationResult(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Verification unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    refresh()
  }, [refresh, stateId])

  const verification = verificationResult?.result || null
  const propagation = summarizePropagation(verification?.linkPropagation)
  const missingRefs = Array.isArray(verification?.missingRefs) ? verification.missingRefs : []
  const affectedRefs = Array.isArray(latestActionRecord?.affectedRefs) ? latestActionRecord.affectedRefs : []
  const expectedPostconditions = Array.isArray(verification?.expectedPostconditions) ? verification.expectedPostconditions : []
  const verificationHints = Array.isArray(verification?.verificationHints) ? verification.verificationHints : []

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
          {t.runtimeVerification}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimeVerificationUnavailable}: {error}
        </div>
      ) : latestActionRecord && verification ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationAction}</strong>{' '}
            {latestActionRecord.action?.name || '-'} · {latestActionRecord.actor || '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationPrimitive}</strong>{' '}
            {latestActionRecord.primitive || '-'} · {verification.verified ? t.runtimeEvidencePass : t.runtimeEvidenceProbe}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationRefs}</strong>{' '}
            {affectedRefs.length ? affectedRefs.map((ref) => formatRuntimeRef(ref)).join(', ') : '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationPropagation}</strong>{' '}
            {propagation.passedCount}/{propagation.linkCount} · {propagation.ok ? t.runtimeEvidencePass : t.runtimeEvidenceProbe}
          </div>
          {expectedPostconditions.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationPostconditions}</strong>{' '}
              {expectedPostconditions
                .slice(0, 2)
                .map((condition) => condition?.description)
                .filter(Boolean)
                .join(' · ')}
            </div>
          ) : null}
          {verificationHints.length > 0 ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationHints}</strong>{' '}
              {verificationHints.slice(0, 2).join(' · ')}
            </div>
          ) : null}
          {missingRefs.length > 0 ? (
            <div style={{ color: 'var(--warning)' }}>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationMissingRefs}</strong>{' '}
              {missingRefs.map((ref) => formatRuntimeRef(ref)).join(', ')}
            </div>
          ) : null}
          {verification.traceEvidence?.stateId ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimeVerificationState}</strong>{' '}
              {verification.traceEvidence.stateId}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimeVerificationEmpty}
        </div>
      )}
    </section>
  )
}

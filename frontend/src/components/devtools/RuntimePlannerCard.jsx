import { useCallback, useEffect, useState } from 'react'
import { workspacePlan } from 'widgetva-kit/transport-inspect'
import t from '../../locale.js'
import { canInspectRuntime } from './runtimeCardAvailability.js'

export default function RuntimePlannerCard({
  runtime,
  planningRequest,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)

  const refresh = useCallback(async () => {
    if (!canInspectRuntime(runtime)) {
      setPlan(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextPlan = await workspacePlan(planningRequest || {})
      setPlan(nextPlan)
      setError('')
    } catch (nextError) {
      setPlan(null)
      setError(nextError instanceof Error ? nextError.message : String(nextError || 'Planner unavailable'))
    } finally {
      setLoading(false)
    }
  }, [runtime, planningRequest])

  useEffect(() => {
    refresh()
  }, [refresh])

  const widgets = Array.isArray(plan?.widgets) ? plan.widgets : []
  const links = Array.isArray(plan?.links) ? plan.links : []
  const rationale = Array.isArray(plan?.rationale) ? plan.rationale.slice(0, 2) : []
  const task = planningRequest?.task || null
  const runMode = planningRequest?.runMode || null
  const complexityBudget = planningRequest?.complexityBudget || null
  const preferredTopology = planningRequest?.preferredTopology || null
  const userIntent = planningRequest?.userIntent || null

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
          {t.runtimePlanner}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {t.runtimePlannerUnavailable}: {error}
        </div>
      ) : plan ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerTopology}</strong>{' '}
            {plan.topology || '-'} · {plan.planningMode || '-'}
          </div>
          {(runMode || complexityBudget || preferredTopology) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerRequest}</strong>{' '}
              {[runMode, complexityBudget, preferredTopology].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {(task?.taskFamily || task?.coordinationScope || task?.evidenceType || task?.interactionHorizon) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerTask}</strong>{' '}
              {[task?.taskFamily, task?.coordinationScope, task?.evidenceType, task?.interactionHorizon].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {(task?.userQuery || userIntent) ? (
            <div>
              <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerIntent}</strong>{' '}
              {task?.userQuery || userIntent}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerWorkspace}</strong>{' '}
            {plan.title || '-'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerWidgets}</strong>{' '}
            {widgets.length}
          </div>
          {widgets.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {widgets.slice(0, 3).map((widget) => (
                <div key={widget.widgetId} style={{ color: 'var(--text-dim)' }}>
                  {widget.role || 'widget'} · {widget.kind || widget.source?.kind || 'baseSpec'} · {widget.widgetId}
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerLinks}</strong>{' '}
            {links.length}
          </div>
          {links.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              {links.slice(0, 3).map((link) => (
                <div key={link.linkId} style={{ color: 'var(--text-dim)' }}>
                  {link.primitive || '-'} · {link.sourceWidgetId || '-'} → {link.targetWidgetId || '-'}
                </div>
              ))}
            </div>
          ) : null}
          {rationale.length > 0 ? (
            <div style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{t.runtimePlannerRationale}</strong>
              </div>
              {rationale.map((item, index) => (
                <div key={`rationale-${index}`} style={{ color: 'var(--text-dim)' }}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          {t.runtimePlannerEmpty}
        </div>
      )}
    </section>
  )
}

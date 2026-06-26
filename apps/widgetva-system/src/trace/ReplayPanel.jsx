import { useAppStore } from '../app/appStore.js'

export function ReplayPanel() {
  const replaySteps = useAppStore((state) => state.replaySteps)

  return (
    <div className="trace-grid">
      {replaySteps.map((step) => (
        <article key={step.id} className="trace-card">
          <strong>{step.title}</strong>
          <p>{step.detail}</p>
        </article>
      ))}
    </div>
  )
}

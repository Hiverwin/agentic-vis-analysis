import { useAppStore } from '../app/appStore.js'

export function ExecutionLogPanel() {
  const log = useAppStore((state) => state.log)

  return (
    <div className="trace-grid">
      {log.map((entry) => (
        <article key={entry.id} className="trace-card">
          <div className="trace-topline">
            <strong>{entry.type}</strong>
          </div>
          <p>{entry.text}</p>
        </article>
      ))}
    </div>
  )
}

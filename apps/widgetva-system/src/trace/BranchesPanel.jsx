import { useAppStore } from '../app/appStore.js'

export function BranchesPanel() {
  const branches = useAppStore((state) => state.branches)

  return (
    <div className="trace-grid">
      {branches.map((branch) => (
        <article key={branch.id} className="trace-card">
          <div className="trace-topline">
            <strong>{branch.label}</strong>
            <span>{branch.status}</span>
          </div>
          <p>Origin: {branch.origin}</p>
        </article>
      ))}
    </div>
  )
}

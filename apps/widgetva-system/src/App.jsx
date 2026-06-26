import { ErrorBoundary } from './app/ErrorBoundary.jsx'
import { SystemShell } from './layout/SystemShell.jsx'

export default function App() {
  return (
    <ErrorBoundary>
      <SystemShell />
    </ErrorBoundary>
  )
}

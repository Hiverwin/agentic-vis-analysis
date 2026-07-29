import { ErrorBoundary } from './ErrorBoundary.jsx'
import { SystemShell } from './shell/SystemShell.jsx'
import { KitHostPlayground } from '../features/hostPlayground/components/KitHostPlayground.jsx'

function shouldShowHostPlayground() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('hostPlayground') === '1'
}

export default function App() {
  return (
    <ErrorBoundary>
      {shouldShowHostPlayground() ? <KitHostPlayground /> : <SystemShell />}
    </ErrorBoundary>
  )
}

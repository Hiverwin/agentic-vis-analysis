function PanelGlyph({ kind }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (kind === 'data') {
    return <svg {...common}><path d="M3 2.5h10v11H3z" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" /></svg>
  }
  if (kind === 'trace') {
    return <svg {...common}><circle cx="3" cy="4" r="1" /><circle cx="13" cy="12" r="1" /><circle cx="8" cy="8" r="1" /><path d="m3.8 4.6 3.4 2.8m1.6 1.3 3.4 2.8" /></svg>
  }
  if (kind === 'analysis') {
    return <svg {...common}><path d="M3 13V7m5 6V3m5 10V9" /></svg>
  }
  return <svg {...common}><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><path d="M5.5 8h5M8 5.5v5" /></svg>
}

export function PanelHeader({ kind = 'workspace', title, children }) {
  return (
    <div className="panel-header">
      <div className="panel-header-title">
        <span className="panel-header-icon"><PanelGlyph kind={kind} /></span>
        <span>{title}</span>
      </div>
      {children ? <div className="panel-header-actions">{children}</div> : null}
    </div>
  )
}

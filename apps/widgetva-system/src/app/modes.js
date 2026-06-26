export const MODES = [
  {
    id: 'manual',
    label: 'Manual Analysis',
    shortLabel: 'Manual',
    description: 'Human-led exploration with inspect surfaces foregrounded.',
    defaultAnalysisTab: 'analysis',
    defaultTraceTab: 'trace',
    traceOpen: true,
  },
  {
    id: 'copilot',
    label: 'Copilot',
    shortLabel: 'Copilot',
    description: 'Human-led analysis with agent suggestions and bounded execution.',
    defaultAnalysisTab: 'agent',
    defaultTraceTab: 'trace',
    traceOpen: true,
  },
  {
    id: 'autonomous',
    label: 'Autonomous',
    shortLabel: 'Autonomous',
    description: 'Agent-driven analysis on the same workspace with takeover controls visible.',
    defaultAnalysisTab: 'agent',
    defaultTraceTab: 'log',
    traceOpen: true,
  },
]

export function getModeById(modeId) {
  return MODES.find((mode) => mode.id === modeId) || MODES[0]
}

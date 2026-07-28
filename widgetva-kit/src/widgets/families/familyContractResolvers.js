import { describeBarLocalSelectionContract, describeBarVerificationContract } from './bar/index.js'
import { describeHeatmapLocalSelectionContract, describeHeatmapVerificationContract } from './heatmap/index.js'
import { describeLineLocalSelectionContract, describeLineVerificationContract } from './line/index.js'
import {
  describeParallelCoordinatesLocalSelectionContract,
  describeParallelCoordinatesVerificationContract,
} from './parallelCoordinates/index.js'
import { describeSankeyLocalSelectionContract, describeSankeyVerificationContract } from './sankey/index.js'
import { describeScatterLocalSelectionContract, describeScatterVerificationContract } from './scatter/index.js'

export function describeFamilyLocalSelectionContract(kind) {
  if (kind === 'bar') return describeBarLocalSelectionContract()
  if (kind === 'line') return describeLineLocalSelectionContract()
  if (kind === 'scatter') return describeScatterLocalSelectionContract()
  if (kind === 'heatmap') return describeHeatmapLocalSelectionContract()
  if (kind === 'parallelCoordinates') return describeParallelCoordinatesLocalSelectionContract()
  if (kind === 'sankey') return describeSankeyLocalSelectionContract()
  return null
}

export function describeFamilyVerificationContract(kind) {
  if (kind === 'bar') return describeBarVerificationContract()
  if (kind === 'line') return describeLineVerificationContract()
  if (kind === 'scatter') return describeScatterVerificationContract()
  if (kind === 'heatmap') return describeHeatmapVerificationContract()
  if (kind === 'parallelCoordinates') return describeParallelCoordinatesVerificationContract()
  if (kind === 'sankey') return describeSankeyVerificationContract()
  return null
}

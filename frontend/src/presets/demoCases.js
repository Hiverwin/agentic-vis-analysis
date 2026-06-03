import heartDiseaseScatterSource from './specs/heart_disease_scatter.json'

function cloneSpec(spec) {
  return JSON.parse(JSON.stringify(spec))
}

function createHeartDiseaseCaseSpec() {
  const spec = cloneSpec(heartDiseaseScatterSource)

  spec.title = {
    text: '心脏风险模式审查',
    subtitle: '年龄与胆固醇只是起始视图；请沿轨迹验证哪些信号仍然成立',
    anchor: 'start',
  }
  spec.width = 520
  spec.height = 300
  spec.mark = { type: 'point', filled: true, opacity: 0.72, stroke: '#ffffff', strokeWidth: 0.5 }
  spec.encoding = {
    ...spec.encoding,
    color: {
      field: 'Heart Disease',
      type: 'nominal',
      legend: { title: 'Heart Disease', orient: 'top', direction: 'horizontal' },
      scale: { range: ['#4d7ea8', '#d0704f'] },
    },
    size: {
      field: 'Chest pain type',
      type: 'quantitative',
      legend: { title: 'Chest Pain Type' },
      scale: { range: [40, 260] },
    },
    tooltip: [
      { field: 'Age', type: 'quantitative' },
      { field: 'Cholesterol', type: 'quantitative' },
      { field: 'Heart Disease', type: 'nominal' },
      { field: 'Exercise angina', type: 'quantitative' },
      { field: 'Max HR', type: 'quantitative' },
      { field: 'ST depression', type: 'quantitative' },
      { field: 'Chest pain type', type: 'quantitative' },
    ],
  }
  spec.config = {
    view: { stroke: '#d6dbe6' },
    axis: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
    legend: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
  }

  return spec
}

const REGION_GROUPS = ['Central-Cloud', 'Edge-Store', 'Factory-IoT', 'Healthcare-Edge']
const SERVICE_TIERS = ['Tier-A', 'Tier-B', 'Tier-C']
const scatterOpsValues = REGION_GROUPS.flatMap((region, ri) =>
  SERVICE_TIERS.flatMap((tier, ti) =>
    Array.from({ length: 26 }, (_, i) => {
      const baseLatency = 45 + ri * 9 + ti * 6 + (i % 7) * 2
      const baseError = 0.35 + ri * 0.08 + ti * 0.05 + ((i * 3 + ri) % 6) * 0.03
      const baseTraffic = 180 + ri * 70 + ti * 45 + (i % 9) * 32
      return {
        Region: region,
        Tier: tier,
        LatencyMs: Math.round(baseLatency + (i % 3 === 0 ? 8 : 0)),
        ErrorRate: Number((baseError + (i % 4 === 0 ? 0.12 : 0)).toFixed(3)),
        Traffic: Math.round(baseTraffic + (i % 5 === 0 ? 280 : 0)),
      }
    }),
  ),
).concat([
  { Region: 'Global-Backbone', Tier: 'Tier-A', LatencyMs: 168, ErrorRate: 1.22, Traffic: 2200 },
  { Region: 'Global-Backbone', Tier: 'Tier-B', LatencyMs: 174, ErrorRate: 1.31, Traffic: 2350 },
  { Region: 'Global-Backbone', Tier: 'Tier-C', LatencyMs: 182, ErrorRate: 1.42, Traffic: 2480 },
  { Region: 'Legacy-Core', Tier: 'Tier-A', LatencyMs: 152, ErrorRate: 1.08, Traffic: 1980 },
  { Region: 'Legacy-Core', Tier: 'Tier-B', LatencyMs: 159, ErrorRate: 1.15, Traffic: 2060 },
  { Region: 'Legacy-Core', Tier: 'Tier-C', LatencyMs: 167, ErrorRate: 1.26, Traffic: 2140 },
])

const WEEKS = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12']
const lineOpsValues = ['North-Metro', 'South-Hub', 'West-Retail', 'East-Industrial', 'Global-Core'].flatMap((line, li) =>
  WEEKS.map((week, wi) => {
    const isDominant = line === 'Global-Core'
    const base = isDominant ? 142 + wi * 7.4 : 54 + li * 5 + wi * 1.6
    const wobble = isDominant ? ((wi + 1) % 3) * 4.8 : ((wi + li * 2) % 4) * 1.5
    return {
      Week: week,
      Region: line,
      Incidents: Number((base + wobble).toFixed(1)),
    }
  }),
)

export const DEMO_CASES = [
  {
    id: 'goal-oriented-heart-risk-review',
    title: '案例 1 - 人机协作',
    subtitle: '智能体与人类协作分析数据',
    mode: 'goal_oriented',
    prompt:
      '心脏病患者与非患者之间似乎有哪些关键差异？',
    spec: createHeartDiseaseCaseSpec(),
  },
  {
    id: 'autonomous-scatter-operations',
    title: '案例 2 - 自主探索',
    subtitle: '智能体自主探索散点图，给出有意义的结论',
    mode: 'autonomous',
    prompt:
      '请自主探索这张散点图，并总结风险模式。',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: {
        text: '服务运营风险图',
        subtitle: '异常值较多的散点图，适合筛选与缩放后深入分析',
        anchor: 'start',
      },
      width: 520,
      height: 300,
      data: { values: scatterOpsValues },
      mark: { type: 'circle', opacity: 0.72, stroke: '#ffffff', strokeWidth: 0.5 },
      encoding: {
        x: { field: 'LatencyMs', type: 'quantitative', axis: { title: 'Latency (ms)', grid: true, tickCount: 7 } },
        y: {
          field: 'ErrorRate',
          type: 'quantitative',
          axis: { title: 'Error Rate (%)', grid: true, tickCount: 6 },
        },
        color: {
          field: 'Region',
          type: 'nominal',
          legend: { title: 'Region', orient: 'top', direction: 'horizontal', columns: 3 },
          scale: { range: ['#355c7d', '#4d7ea8', '#5f9d9f', '#79b791', '#f2b880', '#dd7c7b'] },
        },
        size: { field: 'Traffic', type: 'quantitative', legend: { title: 'Traffic Volume' }, scale: { range: [30, 820] } },
        tooltip: [
          { field: 'Region', type: 'nominal' },
          { field: 'Tier', type: 'nominal' },
          { field: 'LatencyMs', type: 'quantitative' },
          { field: 'ErrorRate', type: 'quantitative' },
          { field: 'Traffic', type: 'quantitative' },
        ],
      },
      config: {
        view: { stroke: '#d6dbe6' },
        axis: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
        legend: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
      },
    },
  },
  {
    id: 'goal-oriented-line-clarification',
    title: '案例 3 - 引导式',
    subtitle: '智能体引导人类一步步分析与探索',
    mode: 'goal_oriented',
    prompt:
      '我不太确定从哪里开始。这张折线图似乎被某一区域主导，我很难比较其他区域。能否一步步引导我，先让我选择关注方向，再继续分析？',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: {
        text: '各区域每周事件趋势',
        subtitle: '一条主导折线会掩盖较小模式，筛选后更清晰',
        anchor: 'start',
      },
      width: 520,
      height: 300,
      data: { values: lineOpsValues },
      mark: { type: 'line', point: { filled: true, size: 36 }, strokeWidth: 2.2 },
      encoding: {
        x: {
          field: 'Week',
          type: 'ordinal',
          sort: WEEKS,
          axis: { title: 'Week', labelAngle: 0, labelOverlap: true },
        },
        y: {
          field: 'Incidents',
          type: 'quantitative',
          axis: { title: 'Incidents', grid: true, tickCount: 6 },
        },
        color: {
          field: 'Region',
          type: 'nominal',
          legend: { title: 'Region', orient: 'top', direction: 'horizontal', columns: 3 },
          scale: { range: ['#2f5d94', '#4d7ea8', '#7aa6c2', '#97bfbd', '#d0704f'] },
        },
        tooltip: [
          { field: 'Region', type: 'nominal' },
          { field: 'Week', type: 'ordinal' },
          { field: 'Incidents', type: 'quantitative' },
        ],
      },
      config: {
        view: { stroke: '#d6dbe6' },
        axis: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
        legend: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
      },
    },
  },
]

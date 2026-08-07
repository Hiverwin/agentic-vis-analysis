(() => {
  function buildRows() {
    const sites = [
      ['America Tropical Interpretive Center', 'Downtown', 'Interpretive', 7200, -42, 3600, 8, 0],
      ['Chinese American Museum', 'Downtown', 'History', 5900, 24, 3100, 6, 2],
      ['Watts Towers Arts Center', 'South LA', 'Arts', 4300, 38, 2600, 9, 4],
      ['Los Angeles Maritime Museum', 'Harbor', 'History', 5100, 18, 2800, 5, 1],
      ['Travel Town Museum', 'Valley', 'Transport', 6800, 12, 3400, 7, 5],
      ['Banning Residence Museum', 'Harbor', 'History', 3600, 30, 1900, 4, 3],
      ['Lummis Home', 'Northeast', 'Historic Site', 2900, 22, 1600, 5, 6],
      ['Barnsdall Art Park Gallery', 'Central', 'Arts', 4700, 44, 3000, 10, 2],
    ]
    const rows = []
    for (const [museum, region, museum_type, base, trend, spendBase, eventBase, phase] of sites) {
      for (let index = 0; index < 24; index += 1) {
        const year = 2023 + Math.floor(index / 12)
        const month = (index % 12) + 1
        const seasonal = Math.sin(((index + phase) * Math.PI) / 6)
        const summerLift = month >= 6 && month <= 8 ? 780 : 0
        const schoolLift = month === 3 || month === 10 ? 520 : 0
        const marketing_spend = Math.round(spendBase + index * 45 + seasonal * 360 + (month === 7 ? 680 : 0))
        const education_events = Math.max(1, Math.round(eventBase + seasonal * 2 + (month === 10 ? 4 : 0)))
        const visitors = Math.max(700, Math.round(base + trend * index + seasonal * 980 + summerLift + schoolLift + marketing_spend * 0.36 + education_events * 84))
        rows.push({
          date: `${year}-${String(month).padStart(2, '0')}-01`,
          year,
          month,
          month_index: index + 1,
          quarter: `Q${Math.ceil(month / 3)}`,
          museum,
          region,
          museum_type,
          visitors,
          marketing_spend,
          education_events,
          school_visits: Math.round(education_events * 38 + schoolLift / 8 + seasonal * 24),
          ticket_revenue: Math.round(visitors * (museum_type === 'Arts' ? 7.6 : museum_type === 'Transport' ? 6.4 : 5.2)),
          satisfaction: Number(Math.min(4.9, 3.7 + visitors / 18000 + education_events / 80).toFixed(2)),
        })
      }
    }
    return rows
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Shared Source: Marketing Spend vs Visitors',
    width: 620,
    height: 340,
    data: { values: buildRows() },
    mark: { type: 'point', filled: true, size: 72, opacity: 0.72, tooltip: true },
    encoding: {
      x: { field: 'marketing_spend', type: 'quantitative', title: 'Marketing spend' },
      y: { field: 'visitors', type: 'quantitative', title: 'Visitors' },
      color: { field: 'region', type: 'nominal', title: 'Region' },
      shape: { field: 'museum_type', type: 'nominal', title: 'Museum type' },
      tooltip: [
        { field: 'museum', type: 'nominal' },
        { field: 'region', type: 'nominal' },
        { field: 'date', type: 'temporal', timeUnit: 'yearmonth', title: 'Month' },
        { field: 'marketing_spend', type: 'quantitative', format: ',' },
        { field: 'visitors', type: 'quantitative', format: ',' },
        { field: 'education_events', type: 'quantitative' },
      ],
    },
    config: {
      view: { stroke: null },
      axis: { labelFontSize: 12, titleFontSize: 12 },
    },
  }
})()

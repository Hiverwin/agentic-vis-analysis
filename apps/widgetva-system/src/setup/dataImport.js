function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }
    current += char
  }
  values.push(current)
  return values.map((value) => value.trim())
}

function parseNumber(value) {
  const normalized = String(value ?? '').trim()
  if (normalized.length === 0) return null
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function requiredColumnsMissing(headers = []) {
  const required = ['name', 'mpg', 'cylinders', 'horsepower', 'weight', 'acceleration', 'year', 'origin']
  return required.filter((key) => !headers.includes(key))
}

export function parseCarsCsv(text = '') {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    throw new Error('CSV needs a header row and at least one data row.')
  }
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase())
  const missing = requiredColumnsMissing(headers)
  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(', ')}`)
  }
  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line)
    const raw = Object.fromEntries(headers.map((header, headerIndex) => [header, cells[headerIndex] ?? '']))
    const name = raw.name || `row-${index + 1}`
    const row = {
      id: raw.id || slugify(name) || `row-${index + 1}`,
      name,
      mpg: parseNumber(raw.mpg),
      cylinders: parseNumber(raw.cylinders),
      displacement: parseNumber(raw.displacement) ?? 0,
      horsepower: parseNumber(raw.horsepower),
      weight: parseNumber(raw.weight),
      acceleration: parseNumber(raw.acceleration),
      year: parseNumber(raw.year),
      origin: raw.origin,
    }
    const invalidRequired = ['mpg', 'cylinders', 'horsepower', 'weight', 'acceleration', 'year'].filter((key) => row[key] == null)
    if (!row.origin || invalidRequired.length > 0) {
      throw new Error(`Row ${index + 2} has invalid values for: ${[...invalidRequired, !row.origin ? 'origin' : null].filter(Boolean).join(', ')}`)
    }
    return row
  })
  const horsepowerValues = rows.map((row) => row.horsepower).filter(Number.isFinite)
  const origins = [...new Set(rows.map((row) => row.origin))]
  const cylinders = [...new Set(rows.map((row) => row.cylinders))].sort((a, b) => a - b)
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b)
  const horsepowerDomain = [
    Math.min(...horsepowerValues),
    Math.max(...horsepowerValues),
  ]
  return {
    rows,
    dataset: {
      name: 'Uploaded cars-style CSV',
      rows: rows.length,
      fields: headers.length,
      coverage: `${years[0]}-${years[years.length - 1]} · ${origins.join(' / ')}`,
      rowsData: rows,
      horsepowerDomain,
      origins,
      cylinders,
      years,
    },
  }
}

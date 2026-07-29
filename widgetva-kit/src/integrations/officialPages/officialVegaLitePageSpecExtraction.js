import { cloneJsonValue as clone } from '../../shared/clone.js'

export function tryParseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function decodeHtmlEntities(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function resolveSpecNodeByViewId(spec, viewId) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || typeof viewId !== 'string' || viewId.length === 0) {
    return null
  }
  const segments = viewId.split('.')
  let current = spec
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null
    if (/^\d+$/.test(segment)) {
      const index = Number(segment)
      if (!Array.isArray(current) || !Number.isInteger(index)) return null
      current = current[index]
      continue
    }
    current = current[segment]
  }
  return current && typeof current === 'object' ? current : null
}

function stripHtmlTags(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, ' '))
}

function coerceDelimitedValue(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return trimmed
}

function parseDelimitedRow(line, delimiter) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

function parseDelimitedText(text, delimiter = ',') {
  const normalized = typeof text === 'string'
    ? text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : ''
  const lines = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return []

  const headers = parseDelimitedRow(lines[0], delimiter).map((value) => String(value).trim())
  return lines.slice(1).map((line) => {
    const values = parseDelimitedRow(line, delimiter)
    return Object.fromEntries(
      headers.map((header, index) => [header, coerceDelimitedValue(values[index] ?? '')]),
    )
  })
}

export async function loadOfficialPageDataValues({ root, spec }) {
  const dataUrl = typeof spec?.data?.url === 'string' ? spec.data.url : null
  if (!dataUrl || Array.isArray(spec?.data?.values)) {
    return spec
  }

  const fetchImpl =
    root?.fetch?.bind(root)
    || globalThis.fetch?.bind(globalThis)
    || null
  if (typeof fetchImpl !== 'function') {
    return spec
  }

  try {
    const response = await fetchImpl(dataUrl)
    if (!response?.ok) {
      return spec
    }

    const url = tryParseUrl(dataUrl)
    const pathname = url?.pathname?.toLowerCase?.() || dataUrl.toLowerCase()
    if (pathname.endsWith('.json')) {
      const payload = await response.json()
      if (!Array.isArray(payload)) {
        return spec
      }
      return {
        ...spec,
        data: {
          ...(spec.data || {}),
          values: clone(payload),
        },
      }
    }

    const rawText = await response.text()
    const delimiter = pathname.endsWith('.tsv') ? '\t' : ','
    const rows = parseDelimitedText(rawText, delimiter)
    if (!Array.isArray(rows) || rows.length === 0) {
      return spec
    }
    return {
      ...spec,
      data: {
        ...(spec.data || {}),
        values: rows,
      },
    }
  } catch {
    return spec
  }
}

function collectCodeLikeBlocks(html) {
  if (typeof html !== 'string' || html.length === 0) return []
  const matches = []
  const patterns = [
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
  ]

  for (const pattern of patterns) {
    let match = pattern.exec(html)
    while (match) {
      matches.push(decodeHtmlEntities(match[1] || ''))
      match = pattern.exec(html)
    }
  }

  return matches
}

function extractBalancedJsonObject(source, startIndex) {
  if (typeof source !== 'string' || startIndex < 0 || startIndex >= source.length || source[startIndex] !== '{') {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function findSchemaAnchoredJson(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  const schemaNeedles = ['"$schema"', '\'${schema}\'', 'https://vega.github.io/schema/vega-lite']

  for (const needle of schemaNeedles) {
    let fromIndex = 0
    while (fromIndex < text.length) {
      const hitIndex = text.indexOf(needle, fromIndex)
      if (hitIndex === -1) break

      for (let cursor = hitIndex; cursor >= 0; cursor -= 1) {
        if (text[cursor] !== '{') continue
        const candidate = extractBalancedJsonObject(text, cursor)
        if (!candidate) continue
        try {
          const parsed = JSON.parse(candidate)
          if (typeof parsed?.$schema === 'string' && parsed.$schema.includes('vega-lite')) {
            return parsed
          }
        } catch {}
      }

      fromIndex = hitIndex + needle.length
    }
  }

  return null
}

function absolutizeDataUrls(node, pageUrl, inDataScope = false) {
  if (Array.isArray(node)) {
    return node.map((entry) => absolutizeDataUrls(entry, pageUrl, inDataScope))
  }
  if (!node || typeof node !== 'object') {
    return node
  }

  const next = {}
  for (const [key, value] of Object.entries(node)) {
    if (inDataScope && key === 'url' && typeof value === 'string') {
      try {
        next[key] = new URL(value, pageUrl).href
      } catch {
        next[key] = value
      }
      continue
    }
    next[key] = absolutizeDataUrls(value, pageUrl, key === 'data')
  }
  return next
}

export function addHeatmapAxisAliasesToRows(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return spec
  }

  const mark = typeof spec?.mark === 'string' ? spec.mark : spec?.mark?.type
  const rows = spec?.data?.values
  if (mark !== 'rect' || !Array.isArray(rows) || rows.length === 0) {
    return spec
  }

  const xField = typeof spec?.encoding?.x?.field === 'string' ? spec.encoding.x.field : null
  const yField = typeof spec?.encoding?.y?.field === 'string' ? spec.encoding.y.field : null
  if (!xField && !yField) {
    return spec
  }

  const aliasedRows = rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return row
    }

    const nextRow = { ...row }
    if (xField && !Object.prototype.hasOwnProperty.call(nextRow, 'x') && Object.prototype.hasOwnProperty.call(nextRow, xField)) {
      nextRow.x = nextRow[xField]
    }
    if (yField && !Object.prototype.hasOwnProperty.call(nextRow, 'y') && Object.prototype.hasOwnProperty.call(nextRow, yField)) {
      nextRow.y = nextRow[yField]
    }
    return nextRow
  })

  return {
    ...spec,
    data: {
      ...(spec.data || {}),
      values: aliasedRows,
    },
  }
}

export function extractOfficialVegaLitePageSpecFromText(text) {
  return findSchemaAnchoredJson(text)
}

export function extractOfficialVegaLitePageSpecFromHtml(html) {
  const codeBlocks = collectCodeLikeBlocks(html)
  for (const block of codeBlocks) {
    const spec = extractOfficialVegaLitePageSpecFromText(block)
    if (spec) return spec
  }
  return extractOfficialVegaLitePageSpecFromText(stripHtmlTags(html))
}

export function normalizeOfficialVegaLitePageSpec(spec, pageUrl) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('normalizeOfficialVegaLitePageSpec requires a Vega-Lite spec object.')
  }
  const effectivePageUrl = typeof pageUrl === 'string' && pageUrl.length > 0 ? pageUrl : null
  return effectivePageUrl ? absolutizeDataUrls(clone(spec), effectivePageUrl) : clone(spec)
}

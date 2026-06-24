function describeExpectedTypes(type) {
  if (Array.isArray(type)) return type.join(' or ')
  return typeof type === 'string' ? type : 'valid value'
}

function isTypeMatch(value, type) {
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value)
  if (type === 'null') return value === null
  return true
}

function validateCompositeSchema(value, schema, path) {
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const errors = []
    for (const candidate of schema.anyOf) {
      try {
        validateAgainstSchema(value, candidate, path)
        return
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }
    throw new Error(`${path} must satisfy at least one allowed schema. ${errors[0] || ''}`.trim())
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    let passedCount = 0
    let lastError = null
    for (const candidate of schema.oneOf) {
      try {
        validateAgainstSchema(value, candidate, path)
        passedCount += 1
      } catch (error) {
        lastError = error
      }
    }
    if (passedCount !== 1) {
      throw new Error(
        passedCount === 0
          ? `${path} must satisfy exactly one allowed schema. ${lastError instanceof Error ? lastError.message : ''}`.trim()
          : `${path} matches multiple incompatible schemas.`,
      )
    }
  }
}

function validateType(value, schema, path) {
  if (schema.type == null) return
  const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type]
  if (!allowedTypes.some((type) => isTypeMatch(value, type))) {
    throw new Error(`${path} must be ${describeExpectedTypes(schema.type)}.`)
  }
}

function validateScalarConstraints(value, schema, path) {
  if (schema.const !== undefined && value !== schema.const) {
    throw new Error(`${path} must equal ${JSON.stringify(schema.const)}.`)
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0 && !schema.enum.includes(value)) {
    throw new Error(`${path} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}.`)
  }

  if (typeof value === 'number') {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) {
      throw new Error(`${path} must be >= ${schema.minimum}.`)
    }
    if (Number.isFinite(schema.maximum) && value > schema.maximum) {
      throw new Error(`${path} must be <= ${schema.maximum}.`)
    }
  }

  if (typeof value === 'string') {
    if (Number.isFinite(schema.minLength) && value.length < schema.minLength) {
      throw new Error(`${path} must contain at least ${schema.minLength} characters.`)
    }
    if (Number.isFinite(schema.maxLength) && value.length > schema.maxLength) {
      throw new Error(`${path} must contain at most ${schema.maxLength} characters.`)
    }
  }
}

function validateArray(value, schema, path) {
  if (!Array.isArray(value)) return
  if (Number.isFinite(schema.minItems) && value.length < schema.minItems) {
    throw new Error(`${path} must contain at least ${schema.minItems} items.`)
  }
  if (Number.isFinite(schema.maxItems) && value.length > schema.maxItems) {
    throw new Error(`${path} must contain at most ${schema.maxItems} items.`)
  }
  if (schema.items && typeof schema.items === 'object') {
    value.forEach((item, index) => validateAgainstSchema(item, schema.items, `${path}[${index}]`))
  }
}

function validateObject(value, schema, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return

  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    if (!(key in value) || value[key] == null) {
      throw new Error(`${path}.${key} is required.`)
    }
  }

  const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
  for (const [key, childSchema] of Object.entries(properties)) {
    if (!(key in value) || value[key] == null) continue
    validateAgainstSchema(value[key], childSchema, `${path}.${key}`)
  }

  if (schema.additionalProperties === false) {
    const allowedKeys = new Set(Object.keys(properties))
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`${path}.${key} is not allowed.`)
      }
    }
  }
}

export function validateAgainstSchema(value, schema, path = 'value') {
  if (!schema || typeof schema !== 'object') return
  if (value == null) {
    if (schema.nullable === true) return
    if (schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null'))) return
  }

  validateCompositeSchema(value, schema, path)
  validateType(value, schema, path)
  validateScalarConstraints(value, schema, path)
  validateArray(value, schema, path)
  validateObject(value, schema, path)
}

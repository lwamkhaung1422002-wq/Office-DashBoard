import { DomainError } from '../../lib/errors.js'

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  return date.toISOString()
}

export function validateRecordPayload(fields, input, { partial = false } = {}) {
  const known = new Map(fields.map(field => [field.key, field]))
  const unknown = Object.keys(input).filter(key => !known.has(key))
  if (unknown.length) throw new DomainError(422, 'UNKNOWN_DATA_FIELDS', 'The record contains fields that are not defined', { fields: unknown })

  const output = {}
  const errors = []
  for (const field of fields) {
    if (partial && !Object.hasOwn(input, field.key)) continue
    const value = input[field.key]
    if (value === undefined || value === null || value === '') {
      if (field.required) errors.push({ field: field.key, code: 'REQUIRED' })
      else if (Object.hasOwn(input, field.key)) output[field.key] = null
      continue
    }
    if (field.type === 'TEXT') output[field.key] = String(value).trim()
    if (field.type === 'NUMBER') {
      const number = typeof value === 'number' ? value : Number(String(value).replaceAll(',', ''))
      if (!Number.isFinite(number)) errors.push({ field: field.key, code: 'INVALID_NUMBER' })
      else output[field.key] = number
    }
    if (field.type === 'DATE') {
      const date = normalizeDate(value)
      if (!date) errors.push({ field: field.key, code: 'INVALID_DATE' })
      else output[field.key] = date
    }
    if (field.type === 'BOOLEAN') {
      if (typeof value === 'boolean') output[field.key] = value
      else if (['true', 'yes', '1'].includes(String(value).toLowerCase())) output[field.key] = true
      else if (['false', 'no', '0'].includes(String(value).toLowerCase())) output[field.key] = false
      else errors.push({ field: field.key, code: 'INVALID_BOOLEAN' })
    }
    if (field.type === 'ENUM') {
      const options = Array.isArray(field.options) ? field.options : []
      if (!options.includes(value)) errors.push({ field: field.key, code: 'INVALID_OPTION', options })
      else output[field.key] = value
    }
  }
  if (errors.length) throw new DomainError(422, 'INVALID_RECORD_DATA', 'Record values do not match the field definitions', { errors })
  return output
}

export function stableFieldKey(label, used = new Set()) {
  const base = String(label).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'field'
  let key = base
  let suffix = 2
  while (used.has(key)) key = `${base}_${suffix++}`
  used.add(key)
  return key
}

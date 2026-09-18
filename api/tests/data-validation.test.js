import { describe, expect, it } from 'vitest'
import { stableFieldKey, validateRecordPayload } from '../server/modules/data/data.validation.js'

const fields = [
  { key: 'department', type: 'TEXT', required: true },
  { key: 'budget', type: 'NUMBER', required: true },
  { key: 'date', type: 'DATE', required: false },
  { key: 'approved', type: 'BOOLEAN', required: false },
  { key: 'status', type: 'ENUM', required: false, options: ['Pending', 'Approved'] },
]

describe('internal data validation', () => {
  it('normalizes typed values while preserving stable field keys', () => {
    const data = validateRecordPayload(fields, { department: ' Finance ', budget: '1,250.50', date: '2026-09-18', approved: 'yes', status: 'Approved' })
    expect(data).toMatchObject({ department: 'Finance', budget: 1250.5, approved: true, status: 'Approved' })
    expect(data.date).toMatch(/^2026-09-18/)
    const used = new Set()
    expect(stableFieldKey('Used Amount', used)).toBe('used_amount')
    expect(stableFieldKey('Used Amount', used)).toBe('used_amount_2')
  })

  it('rejects missing, unknown, and incorrectly typed values', () => {
    expect(() => validateRecordPayload(fields, { department: 'Finance', budget: 'wrong' })).toThrowError(expect.objectContaining({ code: 'INVALID_RECORD_DATA' }))
    expect(() => validateRecordPayload(fields, { department: 'Finance', budget: 20, hidden: 'x' })).toThrowError(expect.objectContaining({ code: 'UNKNOWN_DATA_FIELDS' }))
    expect(() => validateRecordPayload(fields, { budget: 20 })).toThrowError(expect.objectContaining({ code: 'INVALID_RECORD_DATA' }))
  })
})

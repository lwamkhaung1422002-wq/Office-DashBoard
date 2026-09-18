import { describe, expect, it } from 'vitest'
import { validateWidgetConfiguration } from '../server/modules/dashboard/dashboard.service.js'

const fields = [
  { id: 'department', key: 'department', type: 'TEXT', required: false },
  { id: 'budget', key: 'budget', type: 'NUMBER', required: false },
  { id: 'date', key: 'date', type: 'DATE', required: false },
]

describe('dashboard widget validation', () => {
  it('accepts meaningful KPI, pie, and trend configurations', () => {
    expect(() => validateWidgetConfiguration({ chartType: 'KPI', aggregation: 'SUM', measureFieldId: 'budget' }, fields)).not.toThrow()
    expect(() => validateWidgetConfiguration({ chartType: 'PIE', aggregation: 'SUM', dimensionFieldId: 'department', measureFieldId: 'budget' }, fields)).not.toThrow()
    expect(() => validateWidgetConfiguration({ chartType: 'LINE', aggregation: 'SUM', dimensionFieldId: 'date', measureFieldId: 'budget', timeGrouping: 'MONTH' }, fields)).not.toThrow()
  })

  it('rejects nonnumeric measures and invalid trend dimensions', () => {
    expect(() => validateWidgetConfiguration({ chartType: 'PIE', aggregation: 'SUM', dimensionFieldId: 'department', measureFieldId: 'department' }, fields)).toThrowError(expect.objectContaining({ code: 'NUMERIC_MEASURE_REQUIRED' }))
    expect(() => validateWidgetConfiguration({ chartType: 'LINE', aggregation: 'COUNT', dimensionFieldId: 'department', timeGrouping: 'MONTH' }, fields)).toThrowError(expect.objectContaining({ code: 'TIME_DIMENSION_REQUIRED' }))
    expect(() => validateWidgetConfiguration({ chartType: 'BAR', aggregation: 'COUNT' }, fields)).toThrowError(expect.objectContaining({ code: 'DIMENSION_REQUIRED' }))
  })

  it('validates and normalizes saved filters against collection fields', () => {
    expect(validateWidgetConfiguration({ chartType: 'KPI', aggregation: 'COUNT', savedFilters: { budget: '1,250' } }, fields).savedFilters).toEqual({ budget: 1250 })
    expect(() => validateWidgetConfiguration({ chartType: 'KPI', aggregation: 'COUNT', savedFilters: { missing: 'value' } }, fields)).toThrowError(expect.objectContaining({ code: 'UNKNOWN_DATA_FIELDS' }))
  })
})

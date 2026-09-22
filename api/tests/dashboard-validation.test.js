import { describe, expect, it, vi } from 'vitest'
import { createDashboardService, validateWidgetConfiguration } from '../server/modules/dashboard/dashboard.service.js'

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

  it('lists widgets for one collection and previews an unsaved configuration server-side', async () => {
    const findMany = vi.fn(async () => [])
    const prisma = {
      dataCollection: { findFirst: vi.fn(async () => ({ id: 'collection-1', fields })) },
      dashboardWidget: { findMany },
      $queryRaw: vi.fn(async () => [{ value: 7 }]),
    }
    const service = createDashboardService(prisma)
    await service.listAdmin('collection-1')
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ dataCollectionId: 'collection-1' }) }))
    const preview = await service.previewConfiguration({ title: 'Total records', dataCollectionId: 'collection-1', chartType: 'KPI', aggregation: 'COUNT', accessLevel: 'NORMAL', sortOrder: 0, isActive: true })
    expect(preview.data).toEqual({ value: 7 })
    expect(preview.widget.dataCollectionId).toBe('collection-1')
  })
})

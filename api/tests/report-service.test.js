import { describe, expect, it } from 'vitest'
import { createReportService } from '../server/modules/reports/report.service.js'

function database() {
  const collection = { id: 'collection-1', name: 'Budget 2026', archivedAt: null, fields: [{ key: 'department', label: 'Department', type: 'TEXT', position: 0 }, { key: 'budget', label: 'Budget', type: 'NUMBER', position: 1 }] }
  const rows = [
    { id: 'normal', title: 'Normal row', accessLevel: 'NORMAL', payload: { department: 'Finance', budget: 500 }, createdAt: new Date() },
    { id: 'vip', title: 'VIP row', accessLevel: 'VIP', payload: { department: 'Executive', budget: 900 }, createdAt: new Date() },
  ]
  const audits = []
  return {
    audits,
    dataCollection: { findFirst: async () => collection },
    dataRecord: { findMany: async ({ where }) => rows.filter(row => where.accessLevel.in.includes(row.accessLevel)) },
    auditLog: { create: async ({ data }) => { audits.push(data); return data } },
  }
}

describe('authorized reports', () => {
  it('uses the same Normal/VIP access filter for print-friendly output', async () => {
    const db = database()
    const normal = await createReportService(db).generate({ dataCollectionId: 'collection-1', format: 'json' }, { id: 'normal-user', role: 'NORMAL_VIEWER' })
    const vip = await createReportService(db).generate({ dataCollectionId: 'collection-1', format: 'json' }, { id: 'vip-user', role: 'VIP_VIEWER' })
    expect(normal.body.records.map(row => row.id)).toEqual(['normal'])
    expect(vip.body.records.map(row => row.id)).toEqual(['normal', 'vip'])
    expect(db.audits.every(item => item.action === 'REPORT_EXPORTED')).toBe(true)
  })

  it('generates real Excel and PDF output buffers', async () => {
    const db = database()
    const excel = await createReportService(db).generate({ dataCollectionId: 'collection-1', format: 'xlsx' }, { id: 'admin', role: 'ADMIN' })
    const pdf = await createReportService(db).generate({ dataCollectionId: 'collection-1', format: 'pdf' }, { id: 'admin', role: 'ADMIN' })
    expect(excel.body.subarray(0, 2).toString()).toBe('PK')
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF')
  })
})

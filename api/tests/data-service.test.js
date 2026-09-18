import { beforeEach, describe, expect, it } from 'vitest'
import { createDataService } from '../server/modules/data/data.service.js'

function memoryDatabase() {
  const fields = [{ id: 'field-1', key: 'department', label: 'Department', type: 'TEXT', required: true, position: 0 }, { id: 'field-2', key: 'budget', label: 'Budget', type: 'NUMBER', required: true, position: 1 }]
  const collection = { id: 'collection-1', categoryId: 'category-1', name: 'Budget', defaultAccessLevel: 'NORMAL', archivedAt: null, fields }
  const state = { records: [], audits: [] }
  let sequence = 0
  const db = {
    state,
    category: { findFirst: async () => ({ id: 'category-1' }) },
    dataCollection: {
      findFirst: async ({ where }) => where.id === collection.id ? collection : null,
      findMany: async () => [collection],
      findUnique: async () => collection,
    },
    dataRecord: {
      findFirst: async ({ where }) => {
        const row = state.records.find(record => record.id === where.id && (!where.archivedAt || record.archivedAt === where.archivedAt) && (!where.accessLevel || where.accessLevel.in.includes(record.accessLevel)))
        return row ? { ...row, dataCollection: collection } : null
      },
      findMany: async ({ where, take, cursor, skip = 0 }) => state.records
        .filter(record => !record.archivedAt && where.accessLevel.in.includes(record.accessLevel) && (!where.dataCollectionId || record.dataCollectionId === where.dataCollectionId))
        .slice(cursor ? state.records.findIndex(record => record.id === cursor.id) + skip : 0, take),
      create: async ({ data }) => { const row = { id: `record-${++sequence}`, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data }; state.records.push(row); return row },
      update: async ({ where, data }) => Object.assign(state.records.find(record => record.id === where.id), data, { updatedAt: new Date() }),
    },
    auditLog: { create: async ({ data }) => { state.audits.push(data); return data } },
    $transaction: callback => callback(db),
  }
  return { db, collection }
}

describe('unified data service', () => {
  let db
  let service
  beforeEach(() => { ({ db } = memoryDatabase()); service = createDataService(db) })

  it('creates and edits manual records using collection field validation', async () => {
    const created = await service.create({ title: 'Finance budget', categoryId: 'category-1', dataCollectionId: 'collection-1', payload: { department: 'Finance', budget: '500000' } }, 'admin-1')
    expect(created.sourceType).toBe('MANUAL')
    expect(created.sourceImportId).toBeNull()
    expect(created.payload.budget).toBe(500000)
    const updated = await service.update(created.id, { payload: { budget: 550000 } }, 'admin-1')
    expect(updated.payload.budget).toBe(550000)
    expect(db.state.audits.map(item => item.action)).toEqual(['DATA_CREATED', 'DATA_UPDATED'])
  })

  it('edits imported records through the same update path and archives/restores', async () => {
    db.state.records.push({ id: 'excel-1', title: 'Imported', categoryId: 'category-1', dataCollectionId: 'collection-1', payload: { department: 'HR', budget: 250000 }, accessLevel: 'NORMAL', sourceType: 'EXCEL', sourceImportId: 'import-1', archivedAt: null })
    const updated = await service.update('excel-1', { payload: { budget: 275000 } }, 'admin-1')
    expect(updated.sourceType).toBe('EXCEL')
    expect(updated.payload.budget).toBe(275000)
    expect((await service.archive('excel-1', 'admin-1')).archivedAt).toBeInstanceOf(Date)
    expect((await service.restore('excel-1', 'admin-1')).archivedAt).toBeNull()
  })

  it('enforces Normal/VIP access before cursor retrieval', async () => {
    db.state.records.push(
      { id: 'normal-1', accessLevel: 'NORMAL', archivedAt: null, dataCollectionId: 'collection-1' },
      { id: 'vip-1', accessLevel: 'VIP', archivedAt: null, dataCollectionId: 'collection-1' },
    )
    const normal = await service.list({ dataCollectionId: 'collection-1', includeDescendants: true, sortBy: 'createdAt', sortDirection: 'desc', limit: 50 }, 'NORMAL_VIEWER')
    const vip = await service.list({ dataCollectionId: 'collection-1', includeDescendants: true, sortBy: 'createdAt', sortDirection: 'desc', limit: 50 }, 'VIP_VIEWER')
    expect(normal.data.map(row => row.id)).toEqual(['normal-1'])
    expect(vip.data.map(row => row.id)).toEqual(['normal-1', 'vip-1'])
  })
})

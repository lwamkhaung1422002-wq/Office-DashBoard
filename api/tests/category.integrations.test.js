import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'

const secret = 'integration-test-secret-value'
const token = () => jwt.sign({ role: 'VIEWER', name: 'Viewer' }, secret, { subject: 'viewer-1' })

function persistence() {
  const calls = { dataWhere: null, documentWhere: null }
  return {
    calls,
    user: { findUnique: async () => ({ id: 'viewer-1', role: 'VIEWER', name: 'Viewer', isActive: true }) },
    category: { findFirst: async () => ({ id: 'root' }) },
    $queryRaw: async () => [{ id: 'root' }, { id: 'child' }, { id: 'deep' }],
    dataRecord: { findMany: async ({ where }) => { calls.dataWhere = where; return [{ id: 'data-1', categoryId: 'deep' }] } },
    document: { findMany: async ({ where }) => { calls.documentWhere = where; return [{ id: 'doc-1', categoryId: 'child' }] } },
  }
}

describe('Category integrations', () => {
  beforeAll(() => { process.env.JWT_SECRET = secret })

  it('filters Data by the selected category subtree', async () => {
    const db = persistence()
    const response = await request(createApp(db)).get('/api/data?categoryId=root&includeDescendants=true').set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(200)
    expect(db.calls.dataWhere.categoryId.in).toEqual(['root', 'child', 'deep'])
    expect(response.body.meta.categoryId).toBe('root')
  })

  it('filters Documents by the selected category subtree', async () => {
    const db = persistence()
    const response = await request(createApp(db)).get('/api/documents?categoryId=root&includeDescendants=true').set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(200)
    expect(db.calls.documentWhere.categoryId.in).toEqual(['root', 'child', 'deep'])
    expect(response.body.data[0].id).toBe('doc-1')
  })
})

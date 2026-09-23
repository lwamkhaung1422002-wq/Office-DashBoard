import bcrypt from 'bcryptjs'
import ExcelJS from 'exceljs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { prisma } from '../server/lib/prisma.js'

const databaseTests = process.env.RUN_DATABASE_TESTS === 'true'
const suite = databaseTests ? describe : describe.skip
const password = 'Integration-password-2026!'
const tag = `e2e-${Date.now()}`
const users = []
const categories = []

async function login(app, email) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  expect(response.status).toBe(200)
  return response.body.data.accessToken
}

async function workbookBuffer() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Budget')
  sheet.addRow(['2026 Budget Register'])
  sheet.addRow(['Department', 'Budget', 'Date', 'Status'])
  sheet.addRow(['Finance', 500, new Date('2026-01-15'), 'Approved'])
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

suite('complete backend workflow', () => {
  let app
  let admin
  let normal
  let vip
  let adminToken
  let normalToken
  let vipToken
  const objects = new Map()

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-secret-with-more-than-32-characters'
    const passwordHash = await bcrypt.hash(password, 4)
    admin = await prisma.user.create({ data: { email: `${tag}-admin@example.test`, name: 'E2E Admin', role: 'ADMIN', passwordHash, mustChangePassword: false } })
    normal = await prisma.user.create({ data: { email: `${tag}-normal@example.test`, name: 'E2E Normal', role: 'NORMAL_VIEWER', passwordHash, mustChangePassword: false } })
    vip = await prisma.user.create({ data: { email: `${tag}-vip@example.test`, name: 'E2E VIP', role: 'VIP_VIEWER', passwordHash, mustChangePassword: false } })
    users.push(admin.id, normal.id, vip.id)
    const storage = { putObject: async ({ key, body }) => { objects.set(key, Buffer.from(body)); return key }, getObject: async key => objects.get(key) }
    app = createApp(prisma, storage)
    adminToken = await login(app, admin.email)
    normalToken = await login(app, normal.email)
    vipToken = await login(app, vip.email)
  })

  afterAll(async () => {
    if (!databaseTests) return
    await prisma.dashboardWidget.deleteMany({ where: { createdById: { in: users } } })
    await prisma.document.deleteMany({ where: { createdById: { in: users } } })
    await prisma.dataRecord.deleteMany({ where: { createdById: { in: users } } })
    await prisma.importJob.deleteMany({ where: { createdById: { in: users } } })
    await prisma.dataCollection.deleteMany({ where: { createdById: { in: users } } })
    for (const id of categories.reverse()) await prisma.category.deleteMany({ where: { id } })
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } })
    await prisma.refreshToken.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.$disconnect()
  })

  it('keeps setup, reset, and change passwords at a 12-character minimum', async () => {
    for (const endpoint of ['/api/auth/account/setup', '/api/auth/account/reset']) {
      const short = await request(app).post(endpoint).send({ token: 't'.repeat(48), password: 'ElevenChars' })
      expect(short.status).toBe(422)
      expect(short.body.error.code).toBe('VALIDATION_ERROR')
      const twelve = await request(app).post(endpoint).send({ token: 't'.repeat(48), password: 'TwelveChars!' })
      expect(twelve.status).not.toBe(422)
    }
    const shortChange = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${normalToken}`).send({ currentPassword: password, newPassword: 'ElevenChars' })
    expect(shortChange.status).toBe(422)
    const acceptedLength = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${normalToken}`).send({ currentPassword: 'wrong-password', newPassword: 'TwelveChars!' })
    expect(acceptedLength.status).toBe(401)
    expect(acceptedLength.body.error.code).toBe('INVALID_CURRENT_PASSWORD')
  })

  it('runs admin import, manual data, documents, dashboard, reports, audit, and access isolation', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` }
    const createCategory = async (name, parentId) => {
      const response = await request(app).post('/api/admin/categories').set(auth).send({ name: `${name}-${tag}`, ...(parentId ? { parentId } : {}) })
      expect(response.status).toBe(201)
      categories.push(response.body.data.id)
      return response.body.data
    }
    const finance = await createCategory('Finance')
    const budget = await createCategory('Budget', finance.id)
    const year = await createCategory('2026', budget.id)
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) await createCategory(quarter, year.id)

    const inspect = await request(app)
      .post('/api/admin/imports/excel/inspect').set(auth)
      .field('categoryId', year.id).attach('file', await workbookBuffer(), { filename: 'Budget-2026.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    expect(inspect.status).toBe(201)
    expect(inspect.body.data).toMatchObject({ status: 'INSPECTED', validRows: 1, invalidRows: 0 })

    const commit = await request(app).post(`/api/admin/imports/${inspect.body.data.id}/commit`).set(auth).send({ collectionName: `Budget ${tag}`, defaultAccessLevel: 'NORMAL' })
    expect(commit.status).toBe(200)
    expect(commit.body.data.status).toBe('COMPLETED')
    const collectionId = commit.body.data.dataCollectionId

    const definition = await request(app).get(`/api/admin/data/collections/${collectionId}`).set(auth)
    expect(definition.status).toBe(200)
    const departmentField = definition.body.data.fields.find(field => field.key === 'department')
    const budgetField = definition.body.data.fields.find(field => field.key === 'budget')
    const dateField = definition.body.data.fields.find(field => field.key === 'date')

    const importedList = await request(app).get(`/api/admin/data?dataCollectionId=${collectionId}`).set(auth)
    const imported = importedList.body.data[0]
    expect(imported.sourceType).toBe('EXCEL')
    const edited = await request(app).patch(`/api/admin/data/${imported.id}`).set(auth).send({ payload: { budget: 550 } })
    expect(edited.body.data.payload.budget).toBe(550)

    const manual = await request(app).post('/api/admin/data').set(auth).send({ title: 'VIP manual budget', categoryId: year.id, dataCollectionId: collectionId, accessLevel: 'VIP', payload: { department: 'Executive', budget: 250, date: '2026-02-01', status: 'Approved' } })
    expect(manual.status).toBe(201)
    expect(manual.body.data).toMatchObject({ sourceType: 'MANUAL', sourceImportId: null })

    const normalRows = await request(app).get(`/api/data?dataCollectionId=${collectionId}`).set('Authorization', `Bearer ${normalToken}`)
    const vipRows = await request(app).get(`/api/data?dataCollectionId=${collectionId}`).set('Authorization', `Bearer ${vipToken}`)
    expect(normalRows.body.data.map(row => row.id)).toEqual([imported.id])
    expect(vipRows.body.data.map(row => row.id).sort()).toEqual([imported.id, manual.body.data.id].sort())
    const normalCollection = await request(app).get(`/api/data/collections/${collectionId}`).set('Authorization', `Bearer ${normalToken}`)
    const vipCollection = await request(app).get(`/api/data/collections/${collectionId}`).set('Authorization', `Bearer ${vipToken}`)
    expect(normalCollection.body.data._count.records).toBe(1)
    expect(vipCollection.body.data._count.records).toBe(2)
    const normalRecordDetails = await request(app).get(`/api/data/${imported.id}`).set('Authorization', `Bearer ${normalToken}`)
    expect(normalRecordDetails.body.data.dataCollection._count.records).toBe(1)

    const normalDocument = await request(app).post('/api/admin/documents').set(auth).field('title', 'Normal policy').field('categoryId', year.id).field('accessLevel', 'NORMAL').attach('file', Buffer.from('%PDF-test'), { filename: 'normal.pdf', contentType: 'application/pdf' })
    const vipDocument = await request(app).post('/api/admin/documents').set(auth).field('title', 'VIP policy').field('categoryId', year.id).field('accessLevel', 'VIP').attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'vip.jpg', contentType: 'image/jpeg' })
    expect(normalDocument.status).toBe(201)
    expect(vipDocument.status).toBe(201)
    const normalDocuments = await request(app).get('/api/documents').set('Authorization', `Bearer ${normalToken}`)
    const vipDocuments = await request(app).get('/api/documents').set('Authorization', `Bearer ${vipToken}`)
    expect(normalDocuments.body.data.map(item => item.id)).toContain(normalDocument.body.data.id)
    expect(normalDocuments.body.data.map(item => item.id)).not.toContain(vipDocument.body.data.id)
    expect(vipDocuments.body.data.map(item => item.id)).toContain(vipDocument.body.data.id)

    const pie = await request(app).post('/api/admin/dashboard-widgets').set(auth).send({ title: `Budget by department ${tag}`, dataCollectionId: collectionId, chartType: 'PIE', dimensionFieldId: departmentField.id, measureFieldId: budgetField.id, aggregation: 'SUM', accessLevel: 'NORMAL' })
    const trend = await request(app).post('/api/admin/dashboard-widgets').set(auth).send({ title: `Budget trend ${tag}`, dataCollectionId: collectionId, chartType: 'LINE', dimensionFieldId: dateField.id, measureFieldId: budgetField.id, aggregation: 'SUM', timeGrouping: 'MONTH', accessLevel: 'NORMAL', sortOrder: 1 })
    expect(pie.status).toBe(201)
    expect(trend.status).toBe(201)
    for (const chartType of ['KPI', 'PIE', 'BAR', 'LINE', 'CATEGORY_SUMMARY']) {
      const previewPayload = { title: `${chartType} preview`, dataCollectionId: collectionId, chartType, aggregation: 'COUNT', dimensionFieldId: chartType === 'LINE' ? dateField.id : ['PIE', 'BAR'].includes(chartType) ? departmentField.id : null, measureFieldId: null, timeGrouping: chartType === 'LINE' ? 'MONTH' : null, accessLevel: 'NORMAL', sortOrder: 0, isActive: true }
      const preview = await request(app).post('/api/admin/dashboard-widgets/preview').set(auth).send(previewPayload)
      expect(preview.status, JSON.stringify(preview.body)).toBe(200)
      expect(preview.body.data.widget.chartType).toBe(chartType)
      expect(preview.body.data.data).toHaveProperty(chartType === 'KPI' ? 'value' : 'series')
    }
    const invalidPreview = await request(app).post('/api/admin/dashboard-widgets/preview').set(auth).send({ title: 'Invalid', dataCollectionId: collectionId, chartType: 'PIE', aggregation: 'SUM', dimensionFieldId: departmentField.id, measureFieldId: departmentField.id })
    expect(invalidPreview.status).toBe(422)
    expect(invalidPreview.body.error.code).toBe('NUMERIC_MEASURE_REQUIRED')

    const normalDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${normalToken}`)
    const vipDashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${vipToken}`)
    expect(normalDashboard.status, JSON.stringify(normalDashboard.body)).toBe(200)
    expect(vipDashboard.status, JSON.stringify(vipDashboard.body)).toBe(200)
    const normalTotal = normalDashboard.body.data.find(item => item.widget.id === pie.body.data.id).data.series.reduce((sum, point) => sum + point.value, 0)
    const vipTotal = vipDashboard.body.data.find(item => item.widget.id === pie.body.data.id).data.series.reduce((sum, point) => sum + point.value, 0)
    expect(normalTotal).toBe(550)
    expect(vipTotal).toBe(800)

    const normalReport = await request(app).get(`/api/reports/export?dataCollectionId=${collectionId}&format=json`).set('Authorization', `Bearer ${normalToken}`)
    const vipReport = await request(app).get(`/api/reports/export?dataCollectionId=${collectionId}&format=json`).set('Authorization', `Bearer ${vipToken}`)
    expect(normalReport.body.data.records).toHaveLength(1)
    expect(vipReport.body.data.records).toHaveLength(2)

    const tree = await request(app).get(`/api/categories?search=${encodeURIComponent(`2026-${tag}`)}`).set(auth)
    expect(tree.status).toBe(200)
    const details = await request(app).get(`/api/categories/${year.id}`).set(auth)
    expect(details.body.data.breadcrumb.map(item => item.id)).toEqual([finance.id, budget.id, year.id])

    const vipOnly = await createCategory('VIP only')
    const adminOnly = await createCategory('Admin only')
    await request(app).post('/api/admin/documents').set(auth).field('title', 'Confidential VIP').field('categoryId', vipOnly.id).field('accessLevel', 'VIP').attach('file', Buffer.from('%PDF-test'), { filename: 'vip-only.pdf', contentType: 'application/pdf' })
    const hiddenCollection = await request(app).post('/api/admin/data/collections').set(auth).send({ categoryId: adminOnly.id, name: `Hidden ${tag}`, defaultAccessLevel: 'ADMIN', fields: [{ key: 'note', label: 'Note', type: 'TEXT', required: false }] })
    expect(hiddenCollection.status).toBe(201)
    const hiddenRecord = await request(app).post('/api/admin/data').set(auth).send({ categoryId: adminOnly.id, dataCollectionId: hiddenCollection.body.data.id, title: 'Hidden record', accessLevel: 'NORMAL', payload: { note: 'private' } })
    expect(hiddenRecord.status).toBe(201)
    const hiddenWidget = await request(app).post('/api/admin/dashboard-widgets').set(auth).send({ title: 'Hidden collection count', dataCollectionId: hiddenCollection.body.data.id, chartType: 'KPI', aggregation: 'COUNT', accessLevel: 'NORMAL' })
    expect(hiddenWidget.status).toBe(201)
    const normalAuth = { Authorization: `Bearer ${normalToken}` }
    const vipAuth = { Authorization: `Bearer ${vipToken}` }
    const normalTree = await request(app).get('/api/categories').set(normalAuth)
    const vipTree = await request(app).get('/api/categories').set(vipAuth)
    expect(normalTree.body.data.map(item => item.id)).not.toContain(vipOnly.id)
    expect(normalTree.body.data.map(item => item.id)).not.toContain(adminOnly.id)
    expect(vipTree.body.data.map(item => item.id)).toContain(vipOnly.id)
    expect(vipTree.body.data.map(item => item.id)).not.toContain(adminOnly.id)
    expect((await request(app).get(`/api/categories/${vipOnly.id}`).set(normalAuth)).status).toBe(404)
    expect((await request(app).get('/api/data/collections').set(normalAuth)).body.data.map(item => item.id)).not.toContain(hiddenCollection.body.data.id)
    expect((await request(app).get('/api/data').set(normalAuth)).body.data.map(item => item.id)).not.toContain(hiddenRecord.body.data.id)
    expect((await request(app).get(`/api/data/${hiddenRecord.body.data.id}`).set(vipAuth)).status).toBe(404)
    expect((await request(app).get(`/api/data/collections/${hiddenCollection.body.data.id}/filter-options/note`).set(vipAuth)).status).toBe(404)
    expect((await request(app).get('/api/dashboard').set(normalAuth)).body.data.map(item => item.widget.id)).not.toContain(hiddenWidget.body.data.id)
    expect((await request(app).get('/api/dashboard').set(vipAuth)).body.data.map(item => item.widget.id)).not.toContain(hiddenWidget.body.data.id)
    expect((await request(app).get('/api/admin/users').set(normalAuth)).status).toBe(403)
    expect((await request(app).post('/api/admin/data').set(vipAuth).send({})).status).toBe(403)

    const audit = await request(app).get('/api/admin/audit?entityType=DataRecord').set(auth)
    expect(audit.status).toBe(200)
    expect(audit.body.data.map(item => item.action)).toEqual(expect.arrayContaining(['DATA_CREATED', 'DATA_UPDATED']))

    const archiveDocument = await request(app).post(`/api/admin/documents/${normalDocument.body.data.id}/archive`).set(auth)
    expect(archiveDocument.body.data.archivedAt).toBeTruthy()
  }, 30_000)
})

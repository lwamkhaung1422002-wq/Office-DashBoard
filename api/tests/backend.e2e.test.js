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

    const audit = await request(app).get('/api/admin/audit?entityType=DataRecord').set(auth)
    expect(audit.status).toBe(200)
    expect(audit.body.data.map(item => item.action)).toEqual(expect.arrayContaining(['DATA_CREATED', 'DATA_UPDATED']))

    const archiveDocument = await request(app).post(`/api/admin/documents/${normalDocument.body.data.id}/archive`).set(auth)
    expect(archiveDocument.body.data.archivedAt).toBeTruthy()
  }, 30_000)
})

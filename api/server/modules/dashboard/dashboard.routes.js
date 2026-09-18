import { Router } from 'express'
import { z } from 'zod'
import { requireRoles } from '../../middleware/auth.js'
import { createDashboardService } from './dashboard.service.js'

const id = z.string().cuid()
const access = z.enum(['NORMAL', 'VIP', 'ADMIN'])
const baseSchema = z.object({ title: z.string().trim().min(1).max(180), dataCollectionId: id, chartType: z.enum(['KPI', 'PIE', 'BAR', 'LINE', 'CATEGORY_SUMMARY']), dimensionFieldId: id.nullable().optional(), measureFieldId: id.nullable().optional(), aggregation: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']), timeGrouping: z.enum(['DAY', 'MONTH', 'QUARTER', 'YEAR']).nullable().optional(), savedFilters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable().optional(), accessLevel: access.default('NORMAL'), sortOrder: z.number().int().min(0).max(10000).default(0), isActive: z.boolean().default(true) })
const updateSchema = baseSchema.partial().refine(value => Object.keys(value).length > 0, 'At least one field is required')

export function adminDashboardRoutes(prisma) {
  const router = Router()
  const service = createDashboardService(prisma)
  router.use(requireRoles('ADMIN'))
  router.get('/', async (_req, res) => res.json({ data: await service.listAdmin() }))
  router.get('/:id', async (req, res) => res.json({ data: await service.get(id.parse(req.params.id)) }))
  router.get('/:id/preview', async (req, res) => res.json({ data: await service.preview(id.parse(req.params.id)) }))
  router.post('/', async (req, res) => res.status(201).json({ data: await service.create(baseSchema.parse(req.body), req.user.id) }))
  router.patch('/:id', async (req, res) => res.json({ data: await service.update(id.parse(req.params.id), updateSchema.parse(req.body), req.user.id) }))
  router.post('/:id/archive', async (req, res) => res.json({ data: await service.archive(id.parse(req.params.id), req.user.id) }))
  return router
}

export function viewerDashboardRoutes(prisma) {
  const router = Router()
  const service = createDashboardService(prisma)
  router.get('/', async (req, res) => res.json({ data: await service.viewerDashboard(req.user.role) }))
  return router
}

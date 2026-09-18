import { Router } from 'express'
import { z } from 'zod'
import { requireRoles } from '../../middleware/auth.js'
import { createUserService } from './user.service.js'

const idSchema = z.object({ id: z.string().cuid() })
const role = z.enum(['ADMIN', 'NORMAL_VIEWER', 'VIP_VIEWER'])
const createSchema = z.object({ email: z.string().email().max(254), name: z.string().trim().min(1).max(120), role: role.default('NORMAL_VIEWER') })
const updateSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), role: role.optional(), isActive: z.boolean().optional() }).refine(value => Object.keys(value).length > 0, 'At least one field is required')

export function userRoutes(prisma) {
  const router = Router()
  const service = createUserService(prisma)
  router.use(requireRoles('ADMIN'))
  router.get('/', async (_req, res) => res.json({ data: await service.list() }))
  router.get('/:id', async (req, res) => res.json({ data: await service.get(idSchema.parse(req.params).id) }))
  router.post('/', async (req, res) => res.status(201).json({ data: await service.create(createSchema.parse(req.body), req.user.id) }))
  router.patch('/:id', async (req, res) => res.json({ data: await service.update(idSchema.parse(req.params).id, updateSchema.parse(req.body), req.user.id) }))
  router.post('/:id/reset-password', async (req, res) => res.json({ data: await service.resetPassword(idSchema.parse(req.params).id, req.user.id) }))
  return router
}

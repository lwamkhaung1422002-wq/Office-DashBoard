import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { createAuthService } from './auth.service.js'

const credentialsSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) })
const refreshSchema = z.object({ refreshToken: z.string().min(32).max(512) })
const passwordSchema = z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(12).max(128) })

export function authRoutes(prisma) {
  const router = Router()
  const service = createAuthService(prisma)
  router.post('/login', async (req, res) => {
    const credentials = credentialsSchema.parse(req.body)
    const data = await service.login(credentials)
    res.json({ data: { ...data, token: data.accessToken } })
  })
  router.post('/refresh', async (req, res) => res.json({ data: await service.refresh(refreshSchema.parse(req.body).refreshToken) }))
  router.post('/logout', async (req, res) => {
    const parsed = refreshSchema.partial().parse(req.body || {})
    await service.logout(parsed.refreshToken)
    res.status(204).end()
  })
  router.get('/me', requireAuth(prisma), (req, res) => res.json({ data: req.user }))
  router.post('/change-password', requireAuth(prisma), async (req, res) => {
    const input = passwordSchema.parse(req.body)
    res.json({ data: await service.changePassword(req.user.id, input.currentPassword, input.newPassword) })
  })
  return router
}

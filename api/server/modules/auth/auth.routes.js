import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { createAuthService } from './auth.service.js'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie.js'

const credentialsSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) })
const passwordSchema = z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(12).max(128) })

export function authRoutes(prisma) {
  const router = Router()
  const service = createAuthService(prisma)
  router.post('/login', async (req, res) => {
    const credentials = credentialsSchema.parse(req.body)
    const data = await service.login(credentials)
    setRefreshCookie(res, data.refreshToken)
    res.json({ data: { accessToken: data.accessToken, token: data.accessToken, user: data.user } })
  })
  router.post('/refresh', async (req, res) => {
    const rawToken = readRefreshCookie(req)
    if (!rawToken) return res.status(401).json({ error: { code: 'REFRESH_REQUIRED', message: 'A refresh session is required' } })
    try {
      const data = await service.refresh(rawToken)
      setRefreshCookie(res, data.refreshToken)
      res.json({ data: { accessToken: data.accessToken, token: data.accessToken, user: data.user } })
    } catch (error) {
      clearRefreshCookie(res)
      throw error
    }
  })
  router.post('/logout', async (req, res) => {
    await service.logout(readRefreshCookie(req))
    clearRefreshCookie(res)
    res.status(204).end()
  })
  router.get('/me', requireAuth(prisma), (req, res) => res.json({ data: req.user }))
  router.post('/change-password', requireAuth(prisma), async (req, res) => {
    const input = passwordSchema.parse(req.body)
    res.json({ data: await service.changePassword(req.user.id, input.currentPassword, input.newPassword) })
  })
  return router
}

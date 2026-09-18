import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { DomainError } from '../../lib/errors.js'

const credentialsSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) })

export function authRoutes(prisma) {
  const router = Router()
  router.post('/login', async (req, res) => {
    const credentials = credentialsSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } })
    if (!user || !user.isActive || !await bcrypt.compare(credentials.password, user.passwordHash)) {
      throw new DomainError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
    }
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET is not configured')
    const token = jwt.sign({ role: user.role, name: user.name }, secret, { subject: user.id, expiresIn: '8h', algorithm: 'HS256' })
    res.json({ data: { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } } })
  })
  return router
}


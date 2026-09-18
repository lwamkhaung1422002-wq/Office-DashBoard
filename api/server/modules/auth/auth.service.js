import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { DomainError } from '../../lib/errors.js'
import { createAuditService } from '../../lib/audit.js'

const publicUser = user => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
})

const tokenHash = token => createHash('sha256').update(token).digest('hex')

function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
    throw new Error('JWT_SECRET must contain at least 24 characters')
  }
  return process.env.JWT_SECRET
}

function accessToken(user) {
  const expiresIn = /** @type {import('jsonwebtoken').SignOptions['expiresIn']} */ (process.env.ACCESS_TOKEN_TTL || '15m')
  return jwt.sign(
    { role: user.role, name: user.name, mustChangePassword: user.mustChangePassword },
    secret(),
    { subject: user.id, expiresIn, algorithm: 'HS256' },
  )
}

async function refreshToken(prisma, userId) {
  const token = randomBytes(48).toString('base64url')
  const days = Math.max(1, Math.min(90, Number(process.env.REFRESH_TOKEN_DAYS || 14)))
  await prisma.refreshToken.create({
    data: { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + days * 86_400_000) },
  })
  return token
}

export function createAuthService(prisma) {
  return {
    async login({ email, password }) {
      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
      if (!user || !user.isActive || !await bcrypt.compare(password, user.passwordHash)) {
        throw new DomainError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
      }
      const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      return { accessToken: accessToken(updated), refreshToken: await refreshToken(prisma, user.id), user: publicUser(updated) }
    },

    async refresh(rawToken) {
      const session = await prisma.refreshToken.findUnique({
        where: { tokenHash: tokenHash(rawToken) },
        include: { user: true },
      })
      if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
        throw new DomainError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired')
      }
      return prisma.$transaction(async tx => {
        await tx.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
        const nextRefresh = await refreshToken(tx, session.userId)
        return { accessToken: accessToken(session.user), refreshToken: nextRefresh, user: publicUser(session.user) }
      })
    },

    async logout(rawToken) {
      if (!rawToken) return
      await prisma.refreshToken.updateMany({
        where: { tokenHash: tokenHash(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
    },

    async changePassword(userId, currentPassword, newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) {
        throw new DomainError(401, 'INVALID_CURRENT_PASSWORD', 'The current password is incorrect')
      }
      const passwordHash = await bcrypt.hash(newPassword, 12)
      const updated = await prisma.$transaction(async tx => {
        const result = await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } })
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
        await createAuditService(tx).record({ actorId: userId, action: 'USER_PASSWORD_CHANGED', entityType: 'User', entityId: userId })
        return result
      })
      return publicUser(updated)
    },

    publicUser,
  }
}

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createAuditService } from '../../lib/audit.js'
import { notFound } from '../../lib/errors.js'

const selectPublic = { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true, updatedAt: true }

export function generateTemporaryPassword() {
  return `A9!${randomBytes(12).toString('base64url')}`
}

export function createUserService(prisma) {
  return {
    list() {
      return prisma.user.findMany({ select: selectPublic, orderBy: [{ isActive: 'desc' }, { name: 'asc' }], take: 500 })
    },
    async get(id) {
      const user = await prisma.user.findUnique({ where: { id }, select: selectPublic })
      if (!user) throw notFound('User')
      return user
    },
    async create(input, actorId) {
      const temporaryPassword = generateTemporaryPassword()
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)
      const user = await prisma.$transaction(async tx => {
        const created = await tx.user.create({ data: { ...input, email: input.email.toLowerCase(), passwordHash, mustChangePassword: true }, select: selectPublic })
        await createAuditService(tx).record({ actorId, action: 'USER_CREATED', entityType: 'User', entityId: created.id, after: created })
        return created
      })
      return { user, temporaryPassword }
    },
    async update(id, input, actorId) {
      const before = await prisma.user.findUnique({ where: { id }, select: selectPublic })
      if (!before) throw notFound('User')
      const after = await prisma.$transaction(async tx => {
        const updated = await tx.user.update({ where: { id }, data: input, select: selectPublic })
        const audit = createAuditService(tx)
        if (input.role !== undefined && input.role !== before.role) {
          await audit.record({ actorId, action: 'USER_ACCESS_CHANGED', entityType: 'User', entityId: id, before: { role: before.role }, after: { role: updated.role } })
        }
        if (input.isActive !== undefined && input.isActive !== before.isActive) {
          await audit.record({ actorId, action: input.isActive ? 'USER_ENABLED' : 'USER_DISABLED', entityType: 'User', entityId: id, before: { isActive: before.isActive }, after: { isActive: updated.isActive } })
        }
        if (input.name !== undefined && input.name !== before.name) {
          await audit.record({ actorId, action: 'USER_PROFILE_UPDATED', entityType: 'User', entityId: id, before: { name: before.name }, after: { name: updated.name } })
        }
        if (input.isActive === false) await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
        return updated
      })
      return after
    },
    async resetPassword(id, actorId) {
      const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
      if (!existing) throw notFound('User')
      const temporaryPassword = generateTemporaryPassword()
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)
      await prisma.$transaction(async tx => {
        await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } })
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
        await createAuditService(tx).record({ actorId, action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: id })
      })
      return { temporaryPassword }
    },
  }
}

import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { accountLinkRoutes } from '../server/modules/users/user.routes.js'
import { hashAccountToken } from '../server/modules/users/account-tokens.js'

function appWith(prisma) {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', accountLinkRoutes(prisma))
  return app
}

describe('account-link token transport', () => {
  it('validates setup tokens only through a POST JSON body and queries by hash', async () => {
    const token = 's'.repeat(48)
    const findUnique = vi.fn(async ({ where }) => where.tokenHash === hashAccountToken(token) ? {
      id: 'invite-1', name: 'Viewer', email: 'viewer@example.test', role: 'NORMAL_VIEWER', tokenHash: where.tokenHash,
      expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, revokedAt: null,
    } : null)
    const app = appWith({ accountInvite: { findUnique } })
    const response = await request(app).post('/api/auth/account/setup/validate').send({ token })
    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ email: 'viewer@example.test', role: 'NORMAL_VIEWER' })
    expect(findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashAccountToken(token) } })
    expect(findUnique.mock.calls[0][0].where.tokenHash).not.toBe(token)
    expect((await request(app).get(`/api/auth/account/setup?token=${token}`)).status).toBe(404)
  })

  it('validates reset tokens only through a POST JSON body and queries by hash', async () => {
    const token = 'r'.repeat(48)
    const findUnique = vi.fn(async ({ where }) => where.tokenHash === hashAccountToken(token) ? {
      id: 'reset-1', userId: 'user-1', tokenHash: where.tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: null, revokedAt: null,
      user: { id: 'user-1', name: 'Viewer', email: 'viewer@example.test', role: 'VIP_VIEWER', isActive: true },
    } : null)
    const app = appWith({ accountPasswordResetToken: { findUnique } })
    const response = await request(app).post('/api/auth/account/reset/validate').send({ token })
    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ email: 'viewer@example.test' })
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashAccountToken(token) } }))
    expect(findUnique.mock.calls[0][0].where.tokenHash).not.toBe(token)
    expect((await request(app).get(`/api/auth/account/reset?token=${token}`)).status).toBe(404)
  })
})

describe('database token concurrency guards', () => {
  it('defines partial unique indexes for unresolved invitations and active resets', () => {
    const migration = fs.readFileSync(path.resolve(process.cwd(), 'prisma/migrations/20260922160000_active_account_token_guards/migration.sql'), 'utf8')
    expect(migration).toContain('CREATE UNIQUE INDEX "AccountInvite_one_unresolved_per_email"')
    expect(migration).toContain('ON "AccountInvite" (LOWER("email"))')
    expect(migration).toContain('WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL')
    expect(migration).toContain('CREATE UNIQUE INDEX "AccountPasswordResetToken_one_active_per_user"')
    expect(migration).toContain('ON "AccountPasswordResetToken" ("userId")')
    expect(migration).toContain('WHERE "usedAt" IS NULL AND "revokedAt" IS NULL')
  })
})

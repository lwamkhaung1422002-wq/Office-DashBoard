import jwt from 'jsonwebtoken'
import { DomainError } from '../lib/errors.js'

const bearerToken = (header = '') => header.startsWith('Bearer ') ? header.slice(7) : null

export function requireAuth(prisma) {
  return async (req, _res, next) => {
    const token = bearerToken(req.headers.authorization)
    if (!token) return next(new DomainError(401, 'UNAUTHENTICATED', 'Authentication is required'))
    try {
      const secret = process.env.JWT_SECRET
      if (!secret) throw new Error('JWT_SECRET is not configured')
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, name: true, isActive: true } })
      if (!user?.isActive) return next(new DomainError(401, 'ACCOUNT_INACTIVE', 'The account is unavailable'))
      req.user = { id: user.id, role: user.role, name: user.name }
      next()
    } catch (error) {
      if (error instanceof DomainError) return next(error)
      next(new DomainError(401, 'INVALID_TOKEN', 'The access token is invalid or expired'))
    }
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new DomainError(403, 'FORBIDDEN', 'You do not have permission to manage categories'))
    }
    next()
  }
}

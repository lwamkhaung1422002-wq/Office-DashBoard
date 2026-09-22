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
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, name: true, isActive: true, isPrimaryAdmin: true, loginResetRequired: true, mustChangePassword: true } })
      if (!user?.isActive) return next(new DomainError(401, 'ACCOUNT_INACTIVE', 'The account is unavailable'))
      if (user.loginResetRequired) return next(new DomainError(401, 'LOGIN_RESET_REQUIRED', 'Use the secure reset link before signing in again'))
      req.user = { id: user.id, email: user.email, role: user.role, name: user.name, isPrimaryAdmin: user.isPrimaryAdmin, mustChangePassword: user.mustChangePassword }
      next()
    } catch (error) {
      if (error instanceof DomainError) return next(error)
      next(new DomainError(401, 'INVALID_TOKEN', 'The access token is invalid or expired'))
    }
  }
}

export function requirePasswordChanged(req, _res, next) {
  if (req.user?.mustChangePassword) {
    return next(new DomainError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing'))
  }
  next()
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new DomainError(403, 'FORBIDDEN', 'You do not have permission to perform this action'))
    }
    next()
  }
}

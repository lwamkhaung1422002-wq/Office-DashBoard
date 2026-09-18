import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { DomainError } from '../lib/errors.js'

export function notFoundHandler(req, _res, next) {
  next(new DomainError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`))
}

export function errorHandler(error, _req, res, next) {
  void next
  if (error instanceof ZodError) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() } })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists in the selected location' } })
  }
  if (error instanceof DomainError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } })
  }
  console.error(error)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })
}

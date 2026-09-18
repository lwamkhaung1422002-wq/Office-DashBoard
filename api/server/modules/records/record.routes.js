import { Router } from 'express'
import { z } from 'zod'
import { DomainError } from '../../lib/errors.js'

const querySchema = z.object({ categoryId: z.string().min(1).optional(), includeDescendants: z.enum(['true', 'false']).optional().transform(value => value !== 'false') })

async function categoryIds(prisma, rootId, includeDescendants) {
  const root = await prisma.category.findFirst({ where: { id: rootId, archivedAt: null }, select: { id: true } })
  if (!root) throw new DomainError(404, 'CATEGORY_NOT_FOUND', 'Category was not found')
  if (!includeDescendants) return [rootId]
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Category" WHERE id = ${rootId} AND "archivedAt" IS NULL
      UNION ALL
      SELECT child.id FROM "Category" child
      JOIN descendants parent ON child."parentId" = parent.id
      WHERE child."archivedAt" IS NULL
    ) SELECT id FROM descendants
  `
  return rows.map(row => row.id)
}

export function dataRoutes(prisma) {
  const router = Router()
  router.get('/', async (req, res) => {
    const query = querySchema.parse(req.query)
    const ids = query.categoryId ? await categoryIds(prisma, query.categoryId, query.includeDescendants) : null
    const records = await prisma.dataRecord.findMany({ where: { ...(ids ? { categoryId: { in: ids } } : {}), archivedAt: null }, orderBy: { updatedAt: 'desc' } })
    res.json({ data: records, meta: { categoryId: query.categoryId, count: records.length } })
  })
  return router
}

export function documentRoutes(prisma) {
  const router = Router()
  router.get('/', async (req, res) => {
    const query = querySchema.parse(req.query)
    const ids = query.categoryId ? await categoryIds(prisma, query.categoryId, query.includeDescendants) : null
    const documents = await prisma.document.findMany({ where: { ...(ids ? { categoryId: { in: ids } } : {}), archivedAt: null }, orderBy: { updatedAt: 'desc' } })
    res.json({ data: documents, meta: { categoryId: query.categoryId, count: documents.length } })
  })
  return router
}

import { DomainError } from './errors.js'

export async function categoryIds(prisma, rootId, includeDescendants = true) {
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

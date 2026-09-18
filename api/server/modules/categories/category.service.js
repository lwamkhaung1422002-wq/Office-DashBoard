import { DomainError, notFound } from '../../lib/errors.js'
import { allowedAccessLevels } from '../../lib/access.js'
import { createAuditService } from '../../lib/audit.js'

const activeWhere = { archivedAt: null }
const clean = category => ({
  id: category.id,
  name: category.name,
  description: category.description,
  sortOrder: category.sortOrder,
  parentId: category.parentId,
  archivedAt: category.archivedAt,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
  createdBy: category.createdBy ? { name: category.createdBy.name } : null,
})

async function siblingExists(db, { name, parentId, excludeId = undefined }) {
  return db.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, parentId: parentId ?? null, id: excludeId ? { not: excludeId } : undefined },
    select: { id: true },
  })
}

function assembleTree(categories, dataCounts, documentCounts) {
  const byId = new Map(categories.map(category => [category.id, {
    ...clean(category),
    directDataCount: dataCounts.get(category.id) || 0,
    directDocumentCount: documentCounts.get(category.id) || 0,
    dataCount: 0,
    documentCount: 0,
    children: [],
  }]))
  const roots = []
  for (const node of byId.values()) {
    const parent = node.parentId && byId.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = nodes => nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).forEach(node => sort(node.children))
  sort(roots)
  const total = (node, path = new Set()) => {
    if (path.has(node.id)) throw new DomainError(409, 'INVALID_HIERARCHY', 'A circular category hierarchy was detected')
    const next = new Set(path).add(node.id)
    node.dataCount = node.directDataCount
    node.documentCount = node.directDocumentCount
    node.children.forEach(child => {
      total(child, next)
      node.dataCount += child.dataCount
      node.documentCount += child.documentCount
    })
  }
  roots.forEach(root => total(root))
  return { roots, byId }
}

function filterTree(nodes, query) {
  if (!query) return nodes
  const needle = query.toLocaleLowerCase()
  return nodes.flatMap(node => {
    const children = filterTree(node.children, query)
    return node.name.toLocaleLowerCase().includes(needle) || children.length ? [{ ...node, children }] : []
  })
}

async function loadHierarchy(db, includeArchived = false, role) {
  const where = includeArchived ? {} : activeWhere
  const contentWhere = { ...activeWhere, ...(role ? { accessLevel: { in: allowedAccessLevels(role) } } : {}) }
  const [categories, dataGroups, documentGroups] = await Promise.all([
    db.category.findMany({ where, include: { createdBy: { select: { name: true } } } }),
    db.dataRecord.groupBy({ by: ['categoryId'], where: contentWhere, _count: { _all: true } }),
    db.document.groupBy({ by: ['categoryId'], where: contentWhere, _count: { _all: true } }),
  ])
  return assembleTree(
    categories,
    new Map(dataGroups.map(group => [group.categoryId, group._count._all])),
    new Map(documentGroups.map(group => [group.categoryId, group._count._all])),
  )
}

export function createCategoryService(prisma) {
  return {
    async tree({ search = '', includeArchived = false } = {}, role) {
      const { roots } = await loadHierarchy(prisma, includeArchived, role)
      return filterTree(roots, search)
    },

    async details(id, role) {
      const record = await prisma.category.findUnique({ where: { id } })
      if (!record) throw notFound('Category')
      const { roots, byId } = await loadHierarchy(prisma, Boolean(record.archivedAt), role)
      const selected = byId.get(id)
      if (!selected) throw notFound('Category')
      const breadcrumb = []
      const seen = new Set()
      let cursor = selected
      while (cursor) {
        if (seen.has(cursor.id)) throw new DomainError(409, 'INVALID_HIERARCHY', 'A circular category hierarchy was detected')
        seen.add(cursor.id)
        breadcrumb.unshift({ id: cursor.id, name: cursor.name })
        cursor = cursor.parentId ? byId.get(cursor.parentId) : null
      }
      return { category: selected, breadcrumb, children: selected.children, roots: roots.map(({ id: rootId, name: rootName }) => ({ id: rootId, name: rootName })) }
    },

    async create(input, actorId) {
      return prisma.$transaction(async tx => {
        if (input.parentId) {
          const parent = await tx.category.findUnique({ where: { id: input.parentId } })
          if (!parent || parent.archivedAt) throw new DomainError(422, 'INVALID_PARENT', 'The selected parent category is unavailable')
        }
        if (await siblingExists(tx, { name: input.name, parentId: input.parentId })) {
          throw new DomainError(409, 'DUPLICATE_CATEGORY', 'A category with this name already exists in the selected location')
        }
        const category = await tx.category.create({ data: { ...input, parentId: input.parentId ?? null, createdById: actorId } })
        await createAuditService(tx).record({ action: 'CATEGORY_CREATED', entityType: 'Category', entityId: category.id, actorId, before: null, after: clean(category) })
        return clean(category)
      })
    },

    async update(id, input, actorId) {
      return prisma.$transaction(async tx => {
        const current = await tx.category.findUnique({ where: { id } })
        if (!current) throw notFound('Category')
        if (input.name && await siblingExists(tx, { name: input.name, parentId: current.parentId, excludeId: id })) {
          throw new DomainError(409, 'DUPLICATE_CATEGORY', 'A category with this name already exists in the selected location')
        }
        const updated = await tx.category.update({ where: { id }, data: input })
        await createAuditService(tx).record({ action: 'CATEGORY_UPDATED', entityType: 'Category', entityId: id, actorId, before: clean(current), after: clean(updated) })
        return clean(updated)
      })
    },

    async move(id, parentId, actorId) {
      return prisma.$transaction(async tx => {
        const current = await tx.category.findUnique({ where: { id } })
        if (!current) throw notFound('Category')
        if (parentId === id) throw new DomainError(422, 'SELF_PARENT', 'A category cannot be its own parent')
        let parent = null
        let cursorId = parentId
        const seen = new Set()
        while (cursorId) {
          if (cursorId === id) throw new DomainError(422, 'DESCENDANT_PARENT', 'A category cannot be moved under one of its descendants')
          if (seen.has(cursorId)) throw new DomainError(409, 'INVALID_HIERARCHY', 'A circular category hierarchy was detected')
          seen.add(cursorId)
          parent = await tx.category.findUnique({ where: { id: cursorId }, select: { id: true, name: true, parentId: true, archivedAt: true } })
          if (!parent || parent.archivedAt) throw new DomainError(422, 'INVALID_PARENT', 'The selected parent category is unavailable')
          cursorId = parent.parentId
        }
        if (await siblingExists(tx, { name: current.name, parentId, excludeId: id })) {
          throw new DomainError(409, 'DUPLICATE_CATEGORY', 'A category with this name already exists in the selected location')
        }
        const updated = await tx.category.update({ where: { id }, data: { parentId } })
        await createAuditService(tx).record({ action: 'CATEGORY_MOVED', entityType: 'Category', entityId: id, actorId, before: { parentId: current.parentId }, after: { parentId, parentName: parent?.name ?? null } })
        return clean(updated)
      })
    },

    async archive(id, actorId) {
      return prisma.$transaction(async tx => {
        const category = await tx.category.findUnique({ where: { id } })
        if (!category) throw notFound('Category')
        if (category.archivedAt) return clean(category)
        const [children, dataRecords, documents] = await Promise.all([
          tx.category.count({ where: { parentId: id, archivedAt: null } }),
          tx.dataRecord.count({ where: { categoryId: id, archivedAt: null } }),
          tx.document.count({ where: { categoryId: id, archivedAt: null } }),
        ])
        if (children || dataRecords || documents) {
          throw new DomainError(409, 'CATEGORY_NOT_EMPTY', 'Move or archive active child categories, data, and documents before archiving this category', { children, dataRecords, documents })
        }
        const updated = await tx.category.update({ where: { id }, data: { archivedAt: new Date() } })
        await createAuditService(tx).record({ action: 'CATEGORY_ARCHIVED', entityType: 'Category', entityId: id, actorId, before: clean(category), after: clean(updated) })
        return clean(updated)
      })
    },

    async restore(id, actorId) {
      return prisma.$transaction(async tx => {
        const category = await tx.category.findUnique({ where: { id } })
        if (!category) throw notFound('Category')
        if (!category.archivedAt) return clean(category)
        if (category.parentId) {
          const parent = await tx.category.findUnique({ where: { id: category.parentId } })
          if (!parent || parent.archivedAt) throw new DomainError(409, 'ARCHIVED_PARENT', 'Restore the parent category before restoring this category')
        }
        if (await siblingExists(tx, { name: category.name, parentId: category.parentId, excludeId: id })) {
          throw new DomainError(409, 'DUPLICATE_CATEGORY', 'An active category with this name already exists in the selected location')
        }
        const updated = await tx.category.update({ where: { id }, data: { archivedAt: null } })
        await createAuditService(tx).record({ action: 'CATEGORY_RESTORED', entityType: 'Category', entityId: id, actorId, before: clean(category), after: clean(updated) })
        return clean(updated)
      })
    },
  }
}

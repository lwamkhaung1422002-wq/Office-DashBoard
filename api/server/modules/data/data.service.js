import { allowedAccessLevels } from '../../lib/access.js'
import { createAuditService } from '../../lib/audit.js'
import { categoryIds } from '../../lib/categories.js'
import { DomainError, notFound } from '../../lib/errors.js'
import { validateRecordPayload } from './data.validation.js'

const collectionInclude = {
  fields: { orderBy: { position: 'asc' } },
  createdBy: { select: { name: true } },
  _count: { select: { records: { where: { archivedAt: null } } } },
}

function encodeCursor(record) {
  return Buffer.from(JSON.stringify({ id: record.id })).toString('base64url')
}

function decodeCursor(cursor) {
  if (!cursor) return undefined
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!value.id) throw new Error('missing id')
    return { id: value.id }
  } catch {
    throw new DomainError(422, 'INVALID_CURSOR', 'The retrieval cursor is invalid')
  }
}

function accessWhere(role) {
  return { accessLevel: { in: allowedAccessLevels(role) } }
}

export function createDataService(prisma) {
  async function collection(id) {
    const value = await prisma.dataCollection.findFirst({ where: { id, archivedAt: null }, include: collectionInclude })
    if (!value) throw notFound('Data collection')
    return value
  }

  async function recordForUser(id, role, includeArchived = false) {
    const record = await prisma.dataRecord.findFirst({ where: { id, ...accessWhere(role), ...(includeArchived ? {} : { archivedAt: null }) }, include: { dataCollection: { include: collectionInclude } } })
    if (!record) throw notFound('Data record')
    return record
  }

  return {
    async createCollection(input, actorId) {
      const category = await prisma.category.findFirst({ where: { id: input.categoryId, archivedAt: null }, select: { id: true } })
      if (!category) throw new DomainError(422, 'INVALID_CATEGORY', 'The selected category is unavailable')
      return prisma.$transaction(async tx => {
        const created = await tx.dataCollection.create({ data: { categoryId: input.categoryId, name: input.name, description: input.description, defaultAccessLevel: input.defaultAccessLevel, createdById: actorId } })
        await tx.dataField.createMany({ data: input.fields.map((field, position) => ({ ...field, position, dataCollectionId: created.id })) })
        return tx.dataCollection.findUnique({ where: { id: created.id }, include: collectionInclude })
      })
    },
    async updateCollection(id, input, _actorId) {
      const before = await collection(id)
      const previousCategoryId = before.categoryId
      const categoryId = input.categoryId || before.categoryId
      if (input.categoryId) {
        const category = await prisma.category.findFirst({ where: { id: input.categoryId, archivedAt: null }, select: { id: true } })
        if (!category) throw new DomainError(422, 'INVALID_CATEGORY', 'The selected category is unavailable')
      }
      const duplicate = await prisma.dataCollection.findFirst({
        where: { id: { not: id }, categoryId, name: input.name || before.name },
        select: { id: true },
      })
      if (duplicate) throw new DomainError(409, 'DUPLICATE_DATA_COLLECTION', 'A structured data item with this name already exists in the selected folder')
      return prisma.$transaction(async tx => {
        const updated = await tx.dataCollection.update({ where: { id }, data: input, include: collectionInclude })
        if (input.categoryId && input.categoryId !== previousCategoryId) {
          await Promise.all([
            tx.dataRecord.updateMany({ where: { dataCollectionId: id }, data: { categoryId: input.categoryId } }),
            tx.importJob.updateMany({ where: { dataCollectionId: id }, data: { categoryId: input.categoryId } }),
          ])
        }
        return updated
      })
    },
    listCollections(categoryId, role) {
      return prisma.dataCollection.findMany({ where: { archivedAt: null, ...(categoryId ? { categoryId } : {}), ...(role ? { defaultAccessLevel: { in: allowedAccessLevels(role) } } : {}) }, include: collectionInclude, orderBy: { name: 'asc' }, take: 500 })
    },
    async getCollection(id, role) {
      const value = await collection(id)
      if (role && !allowedAccessLevels(role).includes(value.defaultAccessLevel)) throw notFound('Data collection')
      return value
    },
    async archiveCollection(id, actorId) {
      const before = await prisma.dataCollection.findUnique({ where: { id }, include: collectionInclude })
      if (!before) throw notFound('Data collection')
      if (before.archivedAt) return before
      const archivedAt = new Date()
      return prisma.$transaction(async tx => {
        const after = await tx.dataCollection.update({ where: { id }, data: { archivedAt }, include: collectionInclude })
        await tx.dataRecord.updateMany({ where: { dataCollectionId: id, archivedAt: null }, data: { archivedAt } })
        await createAuditService(tx).record({ actorId, action: 'DATA_COLLECTION_ARCHIVED', entityType: 'DataCollection', entityId: id, before, after })
        return after
      })
    },
    async restoreCollection(id, actorId) {
      const before = await prisma.dataCollection.findUnique({ where: { id }, include: { ...collectionInclude, category: { select: { archivedAt: true } } } })
      if (!before) throw notFound('Data collection')
      if (!before.archivedAt) return before
      if (before.category.archivedAt) throw new DomainError(409, 'ARCHIVED_CATEGORY', 'Restore the containing folder before restoring this structured data')
      const deletedAt = before.archivedAt
      return prisma.$transaction(async tx => {
        const after = await tx.dataCollection.update({ where: { id }, data: { archivedAt: null }, include: collectionInclude })
        await tx.dataRecord.updateMany({ where: { dataCollectionId: id, archivedAt: deletedAt }, data: { archivedAt: null } })
        await createAuditService(tx).record({ actorId, action: 'DATA_COLLECTION_RESTORED', entityType: 'DataCollection', entityId: id, before, after })
        return after
      })
    },
    async list(query, role) {
      const take = Math.min(100, Math.max(1, query.limit || 50))
      /** @type {any} */
      const where = { archivedAt: null, ...accessWhere(role) }
      if (query.categoryId) where.categoryId = { in: await categoryIds(prisma, query.categoryId, query.includeDescendants) }
      if (query.dataCollectionId) where.dataCollectionId = query.dataCollectionId
      const definitions = query.dataCollectionId ? (await collection(query.dataCollectionId)).fields : []
      if (query.search) {
        const textFields = definitions.filter(field => ['TEXT', 'ENUM'].includes(field.type))
        where.OR = [
          { title: { contains: query.search, mode: 'insensitive' } },
          ...textFields.map(field => ({ payload: { path: [field.key], string_contains: query.search } })),
        ]
      }
      if (query.filters && definitions.length) {
        const normalized = validateRecordPayload(definitions, query.filters, { partial: true })
        where.AND = Object.entries(normalized).map(([key, value]) => ({ payload: { path: [key], equals: value } }))
      }
      const orderBy = query.sortBy === 'title'
        ? [{ title: query.sortDirection }, { id: query.sortDirection }]
        : [{ [query.sortBy]: query.sortDirection }, { id: query.sortDirection }]
      const records = await prisma.dataRecord.findMany({
        where,
        include: { dataCollection: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
        orderBy,
        take: take + 1,
        cursor: decodeCursor(query.cursor),
        skip: query.cursor ? 1 : 0,
      })
      const hasMore = records.length > take
      const data = records.slice(0, take)
      return { data, meta: { categoryId: query.categoryId || null, nextCursor: hasMore ? encodeCursor(data.at(-1)) : null, limit: take } }
    },
    get(id, role) {
      return recordForUser(id, role)
    },
    async create(input, actorId) {
      const definition = await collection(input.dataCollectionId)
      if (definition.categoryId !== input.categoryId) throw new DomainError(422, 'COLLECTION_CATEGORY_MISMATCH', 'The data collection does not belong to the selected category')
      const payload = validateRecordPayload(definition.fields, input.payload)
      return prisma.$transaction(async tx => {
        const created = await tx.dataRecord.create({ data: { title: input.title, payload, categoryId: input.categoryId, dataCollectionId: input.dataCollectionId, accessLevel: input.accessLevel || definition.defaultAccessLevel, sourceType: 'MANUAL', sourceImportId: null, createdById: actorId } })
        await createAuditService(tx).record({ actorId, action: 'DATA_CREATED', entityType: 'DataRecord', entityId: created.id, after: created })
        return created
      })
    },
    async update(id, input, actorId) {
      const before = await recordForUser(id, 'ADMIN', true)
      const merged = input.payload ? { ...before.payload, ...input.payload } : before.payload
      const payload = validateRecordPayload(before.dataCollection.fields, merged)
      return prisma.$transaction(async tx => {
        const after = await tx.dataRecord.update({ where: { id }, data: { ...input, payload } })
        await createAuditService(tx).record({ actorId, action: 'DATA_UPDATED', entityType: 'DataRecord', entityId: id, before, after })
        return after
      })
    },
    async archive(id, actorId) {
      const before = await recordForUser(id, 'ADMIN', true)
      if (before.archivedAt) return before
      return prisma.$transaction(async tx => {
        const after = await tx.dataRecord.update({ where: { id }, data: { archivedAt: new Date() } })
        await createAuditService(tx).record({ actorId, action: 'DATA_ARCHIVED', entityType: 'DataRecord', entityId: id, before, after })
        return after
      })
    },
    async restore(id, actorId) {
      const before = await recordForUser(id, 'ADMIN', true)
      if (!before.archivedAt) return before
      return prisma.$transaction(async tx => {
        const after = await tx.dataRecord.update({ where: { id }, data: { archivedAt: null } })
        await createAuditService(tx).record({ actorId, action: 'DATA_RESTORED', entityType: 'DataRecord', entityId: id, before, after })
        return after
      })
    },
    async filterOptions(dataCollectionId, fieldKey, role) {
      const definition = await collection(dataCollectionId)
      if (!definition.fields.some(field => field.key === fieldKey)) throw new DomainError(422, 'UNKNOWN_DATA_FIELD', 'The requested field is not defined')
      const rows = await prisma.dataRecord.findMany({ where: { dataCollectionId, archivedAt: null, ...accessWhere(role) }, select: { payload: true }, take: 5000 })
      return [...new Set(rows.map(row => row.payload[fieldKey]).filter(value => value !== null && value !== undefined))].sort()
    },
  }
}

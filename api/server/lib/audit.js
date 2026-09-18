const jsonValue = value => value == null ? value : JSON.parse(JSON.stringify(value))

export function createAuditService(prisma) {
  return {
    record({ actorId = null, action, entityType, entityId, before = null, after = null, metadata = null }) {
      return prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action,
          entityType,
          entityId,
          before: jsonValue(before),
          after: jsonValue(after),
          metadata: jsonValue(metadata),
        },
      })
    },
    async query({ actorId = undefined, action = undefined, entityType = undefined, entityId = undefined, from = undefined, to = undefined, cursor = undefined, limit = 50 }) {
      const take = Math.min(100, Math.max(1, limit))
      const rows = await prisma.auditLog.findMany({
        where: {
          ...(actorId ? { actorId } : {}),
          ...(action ? { action } : {}),
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        },
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      })
      const hasMore = rows.length > take
      const data = rows.slice(0, take)
      return { data, meta: { nextCursor: hasMore ? data.at(-1).id : null, limit: take } }
    },
  }
}

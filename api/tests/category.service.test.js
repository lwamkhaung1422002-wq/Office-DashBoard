import { beforeEach, describe, expect, it } from 'vitest'
import { createCategoryService } from '../server/modules/categories/category.service.js'

function memoryDatabase() {
  let sequence = 0
  const state = { categories: [], data: [], documents: [], audits: [] }
  const matchArchive = (row, where = {}) => !Object.hasOwn(where, 'archivedAt') || row.archivedAt === where.archivedAt
  const db = {
    state,
    category: {
      findMany: async ({ where = {} } = {}) => state.categories.filter(row => matchArchive(row, where)),
      findUnique: async ({ where, select }) => {
        const row = state.categories.find(item => item.id === where.id) || null
        if (!row || !select) return row
        return Object.fromEntries(Object.keys(select).filter(key => select[key]).map(key => [key, row[key]]))
      },
      findFirst: async ({ where }) => state.categories.find(row => {
        const nameMatches = typeof where.name === 'object' ? row.name.toLowerCase() === where.name.equals.toLowerCase() : row.name === where.name
        const idMatches = !where.id?.not || row.id !== where.id.not
        return nameMatches && (row.parentId ?? null) === (where.parentId ?? null) && idMatches
      }) || null,
      create: async ({ data }) => {
        const now = new Date()
        const row = { id: `category-${++sequence}`, description: null, sortOrder: 0, archivedAt: null, createdAt: now, updatedAt: now, ...data }
        state.categories.push(row)
        return row
      },
      update: async ({ where, data }) => {
        const index = state.categories.findIndex(row => row.id === where.id)
        state.categories[index] = { ...state.categories[index], ...data, updatedAt: new Date() }
        return state.categories[index]
      },
      count: async ({ where }) => state.categories.filter(row => row.parentId === where.parentId && matchArchive(row, where)).length,
    },
    dataRecord: {
      groupBy: async ({ where }) => groups(state.data.filter(row => matchArchive(row, where))),
      count: async ({ where }) => state.data.filter(row => row.categoryId === where.categoryId && matchArchive(row, where)).length,
    },
    document: {
      groupBy: async ({ where }) => groups(state.documents.filter(row => matchArchive(row, where))),
      count: async ({ where }) => state.documents.filter(row => row.categoryId === where.categoryId && matchArchive(row, where)).length,
    },
    auditLog: { create: async ({ data }) => { state.audits.push(data); return data } },
    $transaction: callback => callback(db),
  }
  return db
}

function groups(rows) {
  const counts = new Map()
  rows.forEach(row => counts.set(row.categoryId, (counts.get(row.categoryId) || 0) + 1))
  return [...counts].map(([categoryId, count]) => ({ categoryId, _count: { _all: count } }))
}

describe('category service', () => {
  let db
  let service
  beforeEach(() => { db = memoryDatabase(); service = createCategoryService(db) })

  it('creates root, child, and deeply nested categories with audit entries', async () => {
    const root = await service.create({ name: 'Finance' }, 'admin-1')
    const child = await service.create({ name: 'Budget', parentId: root.id }, 'admin-1')
    const deep = await service.create({ name: '2026', parentId: child.id }, 'admin-1')
    expect(deep.parentId).toBe(child.id)
    expect(db.state.audits).toHaveLength(3)
    expect(db.state.audits.every(item => item.action === 'CATEGORY_CREATED')).toBe(true)
  })

  it('returns a sorted tree, breadcrumbs, direct children, search, and subtree counts', async () => {
    const root = await service.create({ name: 'Finance', sortOrder: 2 }, 'admin-1')
    const budget = await service.create({ name: 'Budget', parentId: root.id }, 'admin-1')
    const year = await service.create({ name: '2026', parentId: budget.id }, 'admin-1')
    await service.create({ name: 'Administration', sortOrder: 1 }, 'admin-1')
    db.state.data.push({ categoryId: year.id, archivedAt: null }, { categoryId: budget.id, archivedAt: null })
    db.state.documents.push({ categoryId: year.id, archivedAt: null })

    const tree = await service.tree()
    expect(tree.map(item => item.name)).toEqual(['Administration', 'Finance'])
    expect(tree[1].dataCount).toBe(2)
    expect(tree[1].documentCount).toBe(1)
    const details = await service.details(year.id)
    expect(details.breadcrumb.map(item => item.name)).toEqual(['Finance', 'Budget', '2026'])
    expect((await service.details(root.id)).children.map(item => item.name)).toEqual(['Budget'])
    expect((await service.tree({ search: '2026' }))[0].children[0].children[0].name).toBe('2026')
  })

  it('renames and moves a category while retaining audit context', async () => {
    const first = await service.create({ name: 'First' }, 'admin-1')
    const second = await service.create({ name: 'Second' }, 'admin-1')
    const child = await service.create({ name: 'Child', parentId: first.id }, 'admin-1')
    await service.update(child.id, { name: 'Renamed' }, 'admin-1')
    const moved = await service.move(child.id, second.id, 'admin-1')
    expect(moved.parentId).toBe(second.id)
    expect(db.state.audits.at(-1)).toMatchObject({ action: 'CATEGORY_MOVED', before: { parentId: first.id }, after: { parentId: second.id, parentName: 'Second' } })
  })

  it('rejects self-parenting, descendant-parenting, and invalid parents', async () => {
    const root = await service.create({ name: 'Root' }, 'admin-1')
    const child = await service.create({ name: 'Child', parentId: root.id }, 'admin-1')
    await expect(service.move(root.id, root.id, 'admin-1')).rejects.toMatchObject({ code: 'SELF_PARENT' })
    await expect(service.move(root.id, child.id, 'admin-1')).rejects.toMatchObject({ code: 'DESCENDANT_PARENT' })
    await expect(service.move(root.id, 'missing', 'admin-1')).rejects.toMatchObject({ code: 'INVALID_PARENT' })
    await expect(service.create({ name: 'Orphan', parentId: 'missing' }, 'admin-1')).rejects.toMatchObject({ code: 'INVALID_PARENT' })
  })

  it('rejects unsafe archive and restores only into an active parent', async () => {
    const root = await service.create({ name: 'Root' }, 'admin-1')
    const child = await service.create({ name: 'Child', parentId: root.id }, 'admin-1')
    await expect(service.archive(root.id, 'admin-1')).rejects.toMatchObject({ code: 'CATEGORY_NOT_EMPTY' })
    await service.archive(child.id, 'admin-1')
    await service.archive(root.id, 'admin-1')
    await expect(service.restore(child.id, 'admin-1')).rejects.toMatchObject({ code: 'ARCHIVED_PARENT' })
    await service.restore(root.id, 'admin-1')
    const restored = await service.restore(child.id, 'admin-1')
    expect(restored.archivedAt).toBeNull()
    expect(db.state.audits.at(-1).action).toBe('CATEGORY_RESTORED')
  })

  it('rejects archive when active data or documents remain', async () => {
    const category = await service.create({ name: 'Records' }, 'admin-1')
    db.state.data.push({ categoryId: category.id, archivedAt: null })
    db.state.documents.push({ categoryId: category.id, archivedAt: null })
    await expect(service.archive(category.id, 'admin-1')).rejects.toMatchObject({ code: 'CATEGORY_NOT_EMPTY', details: { dataRecords: 1, documents: 1 } })
  })
})

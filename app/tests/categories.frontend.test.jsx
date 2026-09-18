import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import Categories from '../src/categories/Categories.jsx'
import { categoryKeys, categoryMutationRequest } from '../src/categories/category-queries.js'
import { flattenCategories } from '../src/categories/category-utils.js'

function renderCategories(props = {}, seed) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  seed?.(client)
  return renderToStaticMarkup(<QueryClientProvider client={client}><Categories {...props} /></QueryClientProvider>)
}

describe('Categories frontend', () => {
  it('supports arbitrary hierarchy depth and readable paths', () => {
    const tree = [{ id: '1', name: 'Root', children: [{ id: '2', name: 'Child', children: [{ id: '3', name: 'Deep', children: [] }] }] }]
    expect(flattenCategories(tree).map(item => item.path)).toEqual(['Root', 'Root / Child', 'Root / Child / Deep'])
  })

  it('renders a loading state without exposing technical category fields', () => {
    globalThis.sessionStorage = { getItem: () => JSON.stringify({ role: 'NORMAL_VIEWER' }) }
    const html = renderCategories()
    expect(html).toContain('အမျိုးအစားများ')
    expect(html).toContain('အမျိုးအစားများ ဖွင့်နေသည်')
    expect(html).not.toContain('parentId')
    expect(html).not.toContain('sortOrder')
    expect(html).not.toContain('အမျိုးအစားအသစ်</button>')
  })

  it('shows the real management entry point only to administrators', () => {
    globalThis.sessionStorage = { getItem: () => JSON.stringify({ role: 'ADMIN' }) }
    expect(renderCategories()).toContain('အမျိုးအစားအသစ်</button>')
  })

  it('renders the selected API category, counts, breadcrumb, and direct children', () => {
    globalThis.sessionStorage = { getItem: () => JSON.stringify({ role: 'ADMIN' }) }
    const child = { id: 'child-1', name: 'Q1', description: 'ပထမသုံးလပတ်', dataCount: 4, documentCount: 2, children: [], archivedAt: null }
    const root = { id: 'root-1', name: 'ဘဏ္ဍာရေး', description: 'ဘဏ္ဍာရေးဆိုင်ရာ အချက်အလက်များ', dataCount: 12, documentCount: 5, children: [child], archivedAt: null, createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-09-15T00:00:00.000Z' }
    const html = renderCategories({}, client => {
      client.setQueryData(categoryKeys.tree('', false), [root])
      client.setQueryData(categoryKeys.detail(root.id), { category: root, breadcrumb: [{ id: root.id, name: root.name }], children: [child] })
    })
    expect(html).toContain('ဘဏ္ဍာရေးဆိုင်ရာ အချက်အလက်များ')
    expect(html).toContain('အောက်ခံအမျိုးအစားများ')
    expect(html).toContain('Q1')
    expect(html).toContain('ဒေတာကြည့်ရန်')
    expect(html).toContain('စာရွက်စာတမ်းများကြည့်ရန်')
  })

  it('uses the frozen admin Category API for mutations', async () => {
    globalThis.sessionStorage = { getItem: key => key === 'office_access_token' ? 'access-token' : JSON.stringify({ role: 'ADMIN' }) }
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 'category-1' } }) }))
    await categoryMutationRequest({ mode: 'child', category: { id: 'parent-1' }, values: { name: 'Child', parentId: 'parent-1' } })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/categories', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Child', parentId: 'parent-1' }), headers: expect.objectContaining({ Authorization: 'Bearer access-token' }) }))
  })
})

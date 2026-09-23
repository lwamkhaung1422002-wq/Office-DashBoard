import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ViewerDashboard from '../src/viewer/ViewerDashboard.jsx'
import { loadViewerItems, loadViewerOverview } from '../src/viewer/viewer-data.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('read-only Viewer Dashboard', () => {
  it('uses one viewer shell for Normal and VIP without administrative controls', () => {
    for (const role of ['NORMAL_VIEWER', 'VIP_VIEWER']) {
      const html = renderToStaticMarkup(<ViewerDashboard user={{ name: 'Viewer', role }} onLogout={() => {}} />)
      expect(html).toContain('အစည်းအဝေးတင်ပြမှု Dashboard')
      expect(html).toContain(role === 'VIP_VIEWER' ? 'VIP Viewer' : 'Normal Viewer')
      for (const forbidden of ['Add Widget', 'Customize', 'Add New', 'Archive', 'User & Access', 'File Manager']) expect(html).not.toContain(forbidden)
    }
  })

  it('loads real viewer-safe endpoints with no admin requests', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-token' })
    const fetch = vi.fn(async url => ({ ok: true, status: 200, json: async () => ({ data: url.includes('/categories') ? [{ id: 'category' }] : [], meta: { nextCursor: null } }) }))
    vi.stubGlobal('fetch', fetch)
    const [categories] = await loadViewerOverview()
    expect(categories).toEqual([{ id: 'category' }])
    await loadViewerItems({ categoryId: 'category-id', collectionId: 'collection-id', search: 'budget' })
    const paths = fetch.mock.calls.map(([url]) => url)
    expect(paths).toContain('/api/categories')
    expect(paths).toContain('/api/data/collections')
    expect(paths).toContain('/api/dashboard')
    expect(paths.some(path => path.startsWith('/api/data?') && path.includes('dataCollectionId=collection-id'))).toBe(true)
    expect(paths.some(path => path.startsWith('/api/documents?') && path.includes('categoryId=category-id'))).toBe(true)
    expect(paths.every(path => !path.includes('/admin/'))).toBe(true)
  })
})

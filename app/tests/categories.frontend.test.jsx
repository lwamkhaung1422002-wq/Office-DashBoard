import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import Categories from '../src/categories/Categories.jsx'
import { categoryMutationRequest, folderContentsRequest } from '../src/categories/category-queries.js'
import { filterAndSortItems, flattenCategories, normalizeFileManagerItems } from '../src/categories/category-utils.js'

function renderFileManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(<QueryClientProvider client={client}><Categories /></QueryClientProvider>)
}

describe('File Manager frontend', () => {
  it('supports unlimited folder hierarchy depth and readable paths', () => {
    const tree = [{ id: '1', name: 'Root', children: [{ id: '2', name: 'Child', children: [{ id: '3', name: 'Deep', children: [] }] }] }]
    expect(flattenCategories(tree).map(item => item.path)).toEqual(['Root', 'Root / Child', 'Root / Child / Deep'])
  })

  it('normalizes folders, structured data, and documents into one sortable list', () => {
    const items = normalizeFileManagerItems({
      folders: [{ id: 'f', name: 'Q1', children: [], directDataCount: 1, directDocumentCount: 2 }],
      dataItems: [{ id: 'd', name: 'Budget', _count: { records: 12 }, fields: [] }],
      documents: [{ id: 'p', title: 'Policy', mimeType: 'application/pdf', fileSize: 2048 }],
    })
    expect(items.map(item => item.itemType)).toEqual(['FOLDER', 'DATA', 'PDF'])
    expect(items.map(item => item.sizeLabel)).toEqual(['3 items', '12 records', '2 KB'])
    expect(filterAndSortItems(items, 'budget', 'name').map(item => item.name)).toEqual(['Budget'])
  })

  it('renders the File Explorer body without forbidden toolbar actions', () => {
    globalThis.sessionStorage = { getItem: key => key === 'office_user' ? JSON.stringify({ role: 'ADMIN', name: 'Admin' }) : 'token' }
    const html = renderFileManager()
    expect(html).toContain('Folders')
    expect(html).toContain('New Folder')
    expect(html).toContain('Add File')
    expect(html).toContain('Move to')
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('>Archive<')
    expect(html).not.toContain('>Delete<')
    expect(html).not.toContain('>Copy<')
  })

  it('composes direct current-folder contents from existing real APIs', async () => {
    globalThis.sessionStorage = { getItem: () => 'access-token' }
    globalThis.fetch = vi.fn(async url => ({
      ok: true,
      json: async () => url.includes('/categories/')
        ? { data: { category: { id: 'folder-1' }, breadcrumb: [], children: [{ id: 'child' }] } }
        : { data: url.includes('/collections') ? [{ id: 'data-1' }] : [{ id: 'doc-1' }] },
    }))
    const result = await folderContentsRequest('folder-1')
    expect(result.folders.map(item => item.id)).toEqual(['child'])
    expect(result.dataItems.map(item => item.id)).toEqual(['data-1'])
    expect(result.documents.map(item => item.id)).toEqual(['doc-1'])
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/documents?categoryId=folder-1&includeDescendants=false&limit=100', expect.any(Object))
  })

  it('reuses the frozen Category API for folder mutations', async () => {
    globalThis.sessionStorage = { getItem: () => 'access-token' }
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 'category-1' } }) }))
    await categoryMutationRequest({ mode: 'child', category: { id: 'parent-1' }, values: { name: 'Child', parentId: 'parent-1' } })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/categories', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Child', parentId: 'parent-1' }), headers: expect.objectContaining({ Authorization: 'Bearer access-token' }) }))
  })
})

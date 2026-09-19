import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import Categories, { ContextMenu } from '../src/categories/Categories.jsx'
import { categoryMutationRequest, folderContentsRequest } from '../src/categories/category-queries.js'
import { createCutController, exitTrashThen, filterAndSortItems, flattenCategories, normalizeFileManagerItems } from '../src/categories/category-utils.js'

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
    expect(html).toContain('Recently Deleted')
    expect(html).not.toContain('Back to files')
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('>Archive<')
    expect(html).not.toContain('>Copy<')
  })

  it('shows the required center and folder context actions with Delete below Details', () => {
    const callbacks = { onClose: () => {}, onOpen: () => {}, onNewFolder: () => {}, onAddFile: () => {}, onRename: () => {}, onMove: () => {}, onCut: () => {}, onDetails: () => {}, onDelete: () => {} }
    const html = renderToStaticMarkup(<ContextMenu menu={{ x: 0, y: 0, fromTree: true, item: { id: 'folder-1' } }} {...callbacks} />)
    expect(html).toContain('New Folder')
    expect(html).toContain('Add File')
    expect(html).toContain('Move to…')
    expect(html.indexOf('Delete')).toBeGreaterThan(html.indexOf('Details'))
    expect(html).not.toContain('Copy')
  })

  it('keeps cut state through navigation and clears it only after a successful paste', async () => {
    const clipboard = createCutController()
    const item = { id: 'source-1', itemType: 'FOLDER' }
    clipboard.set([item])
    const destination = 'destination-folder'
    const move = vi.fn(async () => {})
    await clipboard.paste(destination, async (items, folderId) => move(items, folderId))
    expect(move).toHaveBeenCalledWith([item], 'destination-folder')
    expect(clipboard.get()).toEqual([])

    clipboard.set([item])
    await expect(clipboard.paste('broken-folder', async () => { throw new Error('move failed') })).rejects.toThrow('move failed')
    expect(clipboard.get()).toEqual([item])
  })

  it('exits Recently Deleted before folder navigation, New Folder, and Add File actions', () => {
    for (const actionName of ['folder navigation', 'New Folder', 'Add File']) {
      const setTrashMode = vi.fn()
      const action = vi.fn(() => actionName)
      expect(exitTrashThen(setTrashMode, action)).toBe(actionName)
      expect(setTrashMode).toHaveBeenCalledWith(false)
      expect(action).toHaveBeenCalledOnce()
    }
  })

  it('uses one readable File Manager type scale and yellow folder visuals', () => {
    const css = readFileSync(new URL('../src/categories/categories.css', import.meta.url), 'utf8')
    expect(css).toContain("font-family:'Noto Sans Myanmar','Pyidaungsu','Myanmar Text','Segoe UI',sans-serif")
    expect(css).toContain('.fm-item-icon.folder{color:#f2ad19}')
    expect(css).toContain('.fm-tree-name svg{width:22px;height:22px;flex:0 0 auto;color:#f2ad19}')
    expect(css).toContain('.fm-destination-list button>svg{width:24px;height:24px;color:#f2ad19}')
    expect(css).not.toMatch(/font-size:(?:8|9|10|11)px/)
    expect(css).not.toMatch(/font-weight:(?:720|750|760|800|820)/)
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

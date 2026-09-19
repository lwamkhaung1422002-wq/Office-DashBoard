import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CollectionMenu, DataCollectionRow, RecordDialog } from '../src/records/FilteredModules.jsx'
import { clearCollectionContext, createRecordRequest, dataCollectionDetailsRequest, fieldInputType, filterFolderTree, generateRecordTitle, recordQueryParams } from '../src/records/data-workspace-utils.js'

describe('Data workspace frontend', () => {
  const tree = [{ id: 'finance', name: 'Finance', children: [{ id: 'budget', name: 'Budget', children: [] }] }, { id: 'hr', name: 'HR', children: [] }]
  const collection = { id: 'collection-1', categoryId: 'budget', name: '2026 Budget', defaultAccessLevel: 'NORMAL', fields: [{ id: 'f1', key: 'department', label: 'Department', type: 'TEXT', required: true }, { id: 'f2', key: 'amount', label: 'Amount', type: 'NUMBER', required: true }, { id: 'f3', key: 'status', label: 'Status', type: 'ENUM', required: false, options: ['Approved', 'Pending'] }] }

  it('filters only the folder hierarchy while retaining matching ancestors', () => {
    expect(filterFolderTree(tree, 'budget').map(item => item.name)).toEqual(['Finance'])
    expect(filterFolderTree(tree, 'budget')[0].children[0].name).toBe('Budget')
  })

  it('renders Add New location/Data File selection and dynamic collection fields', () => {
    const picker = renderToStaticMarkup(<RecordDialog tree={tree} initialCategory={tree[0]} initialCollection={null} record={null} onClose={() => {}} onSaved={() => {}} refreshTree={async () => {}} />)
    expect(picker).toContain('Location')
    expect(picker).toContain('Data File')
    expect(picker).toContain('New Folder')
    const form = renderToStaticMarkup(<RecordDialog tree={tree} initialCategory={tree[0].children[0]} initialCollection={collection} record={null} onClose={() => {}} onSaved={() => {}} refreshTree={async () => {}} />)
    expect(form).toContain('>Change<')
    expect(form).toContain('Department')
    expect(form).toContain('type="number"')
    expect(form).toContain('>View<')
    expect(form).not.toContain('ခေါင်းစဉ်')
    expect(form).not.toContain('New Folder')
    expect(fieldInputType('BOOLEAN')).toBe('checkbox')
  })

  it('opens a selected collection by double-click or Enter and clears parent context on Back', () => {
    const onOpen = vi.fn()
    const onSelect = vi.fn()
    const row = DataCollectionRow({ item: collection, selected: true, onSelect, onOpen, onMenu: vi.fn() })
    row.props.onClick()
    expect(onSelect).toHaveBeenCalledWith(collection)
    expect(onOpen).not.toHaveBeenCalled()
    row.props.onDoubleClick()
    const preventDefault = vi.fn()
    row.props.onKeyDown({ key: 'Enter', preventDefault })
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenNthCalledWith(1, collection)
    expect(preventDefault).toHaveBeenCalledOnce()

    const setCollection = vi.fn()
    const setSelectedCollectionId = vi.fn()
    const onClearCollection = vi.fn()
    clearCollectionContext({ setCollection, setSelectedCollectionId, onClearCollection })
    expect(setCollection).toHaveBeenCalledWith(null)
    expect(setSelectedCollectionId).toHaveBeenCalledWith(null)
    expect(onClearCollection).toHaveBeenCalledOnce()
  })

  it('renders the exact DataCollection kebab actions in usage order', () => {
    const callback = () => {}
    const html = renderToStaticMarkup(<CollectionMenu position={{ top: 0 }} onClose={callback} onOpen={callback} onAdd={callback} onDashboard={callback} onExport={callback} onDetails={callback} />)
    const labels = ['Open', 'Add New', 'Dashboard', 'Export', 'Details']
    labels.forEach(label => expect(html).toContain(`>${label}<`))
    expect(labels.map(label => html.indexOf(`>${label}<`))).toEqual([...labels.map(label => html.indexOf(`>${label}<`))].sort((a, b) => a - b))
    expect(html).not.toContain('Rename')
    expect(html).not.toContain('Move')
    expect(html).not.toContain('Delete')
  })

  it('loads full collection details before Records View and generates internal record titles', async () => {
    globalThis.sessionStorage = { getItem: () => 'access-token' }
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: collection }) }))
    await expect(dataCollectionDetailsRequest(collection.id)).resolves.toEqual(collection)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/data/collections/collection-1', expect.any(Object))
    expect(generateRecordTitle({ fields: collection.fields, payload: { department: 'Finance' }, collectionName: collection.name })).toBe('Finance')
    expect(generateRecordTitle({ fields: collection.fields, payload: {}, collectionName: collection.name })).toBe('Record - 2026 Budget')
    expect(generateRecordTitle({ fields: collection.fields, payload: { department: 'Changed' }, existingTitle: 'Existing title', collectionName: collection.name })).toBe('Existing title')
  })

  it('wires server-side search, equality filters, sorting, and cursor loading', () => {
    const params = recordQueryParams({ dataCollectionId: 'collection-1', search: 'finance', filters: { status: 'Approved' }, sortBy: 'title', sortDirection: 'asc', cursor: 'next-1' })
    expect(params.get('search')).toBe('finance')
    expect(params.get('filters')).toBe(JSON.stringify({ status: 'Approved' }))
    expect(params.get('cursor')).toBe('next-1')
    expect(params.get('limit')).toBe('50')
  })

  it('creates records through the existing unified DataRecord endpoint', async () => {
    globalThis.sessionStorage = { getItem: () => 'access-token' }
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 'record-1' } }) }))
    await createRecordRequest({ title: 'Budget A', accessLevel: 'NORMAL', payload: { amount: 10 }, categoryId: 'budget', dataCollectionId: 'collection-1' })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/data', expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Budget A', accessLevel: 'NORMAL', payload: { amount: 10 }, categoryId: 'budget', dataCollectionId: 'collection-1' }) }))
  })
})

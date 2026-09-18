import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RecordDialog } from '../src/records/FilteredModules.jsx'
import { createRecordRequest, fieldInputType, filterFolderTree, recordQueryParams } from '../src/records/data-workspace-utils.js'

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
    expect(form).toContain('Department')
    expect(form).toContain('type="number"')
    expect(form).toContain('>View<')
    expect(fieldInputType('BOOLEAN')).toBe('checkbox')
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

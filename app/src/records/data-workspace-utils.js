import { api } from '../api.js'

export function filterFolderTree(nodes, search = '') {
  const needle = search.trim().toLocaleLowerCase()
  return nodes.flatMap(node => {
    const children = filterFolderTree(node.children || [], search)
    return !needle || node.name.toLocaleLowerCase().includes(needle) || children.length ? [{ ...node, children }] : []
  })
}

export function recordQueryParams({ dataCollectionId, search = '', filters = {}, sortBy = 'updatedAt', sortDirection = 'desc', cursor = null, limit = 50 }) {
  return new URLSearchParams({
    dataCollectionId,
    includeDescendants: 'false',
    limit: String(limit),
    sortBy,
    sortDirection,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(Object.keys(filters).length ? { filters: JSON.stringify(filters) } : {}),
    ...(cursor ? { cursor } : {}),
  })
}

export function fieldInputType(type) {
  if (type === 'NUMBER') return 'number'
  if (type === 'DATE') return 'date'
  if (type === 'BOOLEAN') return 'checkbox'
  if (type === 'ENUM') return 'select'
  return 'text'
}

export function createRecordRequest({ title, accessLevel, payload, categoryId, dataCollectionId }) {
  return api('/admin/data', { method: 'POST', body: JSON.stringify({ title, accessLevel, payload, categoryId, dataCollectionId }) })
}

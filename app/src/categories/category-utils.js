export function flattenCategories(nodes, path = [], result = []) {
  nodes.forEach(node => {
    const nextPath = [...path, node.name]
    result.push({ ...node, path: nextPath.join(' / ') })
    flattenCategories(node.children || [], nextPath, result)
  })
  return result
}

export function categoryDescendantIds(node, result = new Set()) {
  for (const child of node?.children || []) {
    result.add(child.id)
    categoryDescendantIds(child, result)
  }
  return result
}

export function normalizeFileManagerItems({ folders = [], dataItems = [], documents = [] } = {}) {
  return [
    ...folders.map(folder => ({
      ...folder,
      itemType: 'FOLDER',
      typeLabel: 'Folder',
      sizeLabel: `${(folder.children?.length || 0) + (folder.directDataCount || 0) + (folder.directDocumentCount || 0)} items`,
      modifiedBy: folder.createdBy?.name || '—',
    })),
    ...dataItems.map(item => ({
      ...item,
      itemType: 'DATA',
      typeLabel: 'Data',
      sizeLabel: `${item._count?.records || 0} records`,
      modifiedBy: item.createdBy?.name || '—',
    })),
    ...documents.map(item => ({
      ...item,
      name: item.title,
      itemType: item.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE',
      typeLabel: item.mimeType === 'application/pdf' ? 'PDF' : 'Image',
      sizeLabel: formatBytes(item.fileSize),
      modifiedBy: item.createdBy?.name || '—',
    })),
  ]
}

export function filterAndSortItems(items, search = '', sortBy = 'name') {
  const needle = search.trim().toLocaleLowerCase()
  const filtered = needle ? items.filter(item => `${item.name} ${item.typeLabel}`.toLocaleLowerCase().includes(needle)) : items
  const value = item => sortBy === 'type' ? item.typeLabel : sortBy === 'updated' ? new Date(item.updatedAt || item.createdAt || 0).valueOf() : item.name.toLocaleLowerCase()
  return [...filtered].sort((a, b) => {
    if (a.itemType === 'FOLDER' && b.itemType !== 'FOLDER') return -1
    if (a.itemType !== 'FOLDER' && b.itemType === 'FOLDER') return 1
    return sortBy === 'updated' ? value(b) - value(a) : String(value(a)).localeCompare(String(value(b)), 'my')
  })
}

export function isEditingTarget(target) {
  return typeof Element !== 'undefined' && target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], form'))
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import ContentCutRounded from '@mui/icons-material/ContentCutRounded'
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined'
import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import ImageRounded from '@mui/icons-material/ImageRounded'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import SortRounded from '@mui/icons-material/SortRounded'
import TableChartRounded from '@mui/icons-material/TableChartRounded'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import ViewListRounded from '@mui/icons-material/ViewListRounded'
import { api, apiBlob } from '../api.js'
import { categoryKeys, useCategoryMutation, useCategoryTree, useFolderContents } from './category-queries.js'
import { categoryDescendantIds, filterAndSortItems, flattenCategories, isEditingTarget, normalizeFileManagerItems } from './category-utils.js'
import './categories.css'

const itemKey = item => `${item.itemType}:${item.id}`
const user = () => JSON.parse(sessionStorage.getItem('office_user') || '{}')

function ItemIcon({ type }) {
  if (type === 'FOLDER') return <FolderRounded />
  if (type === 'DATA') return <TableChartRounded />
  if (type === 'PDF') return <PictureAsPdfRounded />
  return <ImageRounded />
}

function FolderTree({ nodes, selectedId, expanded, onToggle, onSelect, depth = 0 }) {
  return nodes.map(node => {
    const opened = expanded.has(node.id)
    const hasChildren = Boolean(node.children?.length)
    return <div className="fm-tree-branch" key={node.id}>
      <div className={`fm-tree-row ${selectedId === node.id ? 'selected' : ''}`} style={/** @type {import('react').CSSProperties} */ ({ '--tree-depth': depth })}>
        <button type="button" className="fm-tree-toggle" onClick={() => hasChildren && onToggle(node.id)} disabled={!hasChildren} aria-label={opened ? 'Folder ခေါက်ရန်' : 'Folder ဖြန့်ရန်'}>
          {hasChildren && (opened ? <ExpandMoreRounded /> : <ChevronRightRounded />)}
        </button>
        <button type="button" className="fm-tree-name" onClick={() => onSelect(node.id)} onDoubleClick={() => hasChildren && onToggle(node.id)}>
          {opened ? <FolderOpenRounded /> : <FolderRounded />}<span>{node.name}</span>
        </button>
      </div>
      {opened && hasChildren && <FolderTree nodes={node.children} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} depth={depth + 1} />}
    </div>
  })
}

function MoveDialog({ items, tree, onClose, onConfirm, busy, error }) {
  const onlyFolders = items.every(item => item.itemType === 'FOLDER')
  const blocked = useMemo(() => {
    const ids = new Set()
    for (const item of items) {
      if (item.itemType !== 'FOLDER') continue
      ids.add(item.id)
      const node = flattenCategories(tree).find(folder => folder.id === item.id)
      categoryDescendantIds(node, ids)
    }
    return ids
  }, [items, tree])
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(onlyFolders ? '' : null)
  const destinations = useMemo(() => flattenCategories(tree).filter(folder => !blocked.has(folder.id) && folder.path.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [blocked, query, tree])
  return <div className="fm-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <section className="fm-dialog fm-move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-dialog-title">
      <header><div><small>File Manager</small><h2 id="move-dialog-title">Move to</h2></div><button onClick={onClose} disabled={busy} aria-label="ပိတ်ရန်"><CloseRounded /></button></header>
      <div className="fm-dialog-body">
        <p className="fm-dialog-note"><DriveFileMoveOutlined /><span><b>{items.length} item{items.length > 1 ? 's' : ''}</b><small>ရွှေ့လိုသည့် Folder ကို ရွေးပါ</small></span></p>
        <label className="fm-dialog-search"><SearchRounded /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Folder ရှာရန်…" autoFocus /></label>
        <div className="fm-destination-list">
          {onlyFolders && <button className={target === '' ? 'selected' : ''} onClick={() => setTarget('')}><HomeRounded /><span><b>Home</b><small>Root location</small></span></button>}
          {destinations.map(folder => <button key={folder.id} className={target === folder.id ? 'selected' : ''} onClick={() => setTarget(folder.id)}><FolderRounded /><span><b>{folder.name}</b><small>{folder.path}</small></span></button>)}
        </div>
        {error && <p className="fm-error" role="alert">{error}</p>}
      </div>
      <footer><button onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={target === null || busy} onClick={() => onConfirm(target)}>{busy ? 'Moving…' : 'Move here'}</button></footer>
    </section>
  </div>
}

function DetailsDialog({ item, location, onClose }) {
  const rows = item.itemType === 'FOLDER'
    ? [['Type', 'Folder'], ['Location', location], ['Items', item.sizeLabel], ['Created', formatDate(item.createdAt)], ['Modified', formatDate(item.updatedAt)]]
    : item.itemType === 'DATA'
      ? [['Type', 'Structured Data'], ['Location', location], ['Records', item.sizeLabel], ['Fields', `${item.fields?.length || 0}`], ['Access', item.defaultAccessLevel], ['Modified', formatDate(item.updatedAt)]]
      : [['Type', item.typeLabel], ['File name', item.fileName], ['Location', location], ['Size', item.sizeLabel], ['Access', item.accessLevel], ['Uploaded', formatDate(item.createdAt)], ['Modified', formatDate(item.updatedAt)]]
  return <div className="fm-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="fm-dialog fm-details-dialog" role="dialog" aria-modal="true" aria-labelledby="details-dialog-title">
      <header><div><small>Details</small><h2 id="details-dialog-title">{item.name}</h2></div><button onClick={onClose} aria-label="ပိတ်ရန်"><CloseRounded /></button></header>
      <div className="fm-details-hero"><span className={`fm-item-icon ${item.itemType.toLowerCase()}`}><ItemIcon type={item.itemType} /></span><div><b>{item.name}</b><small>{item.typeLabel}</small></div></div>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
      <footer><button className="primary" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}

function UploadDialog({ upload, setUpload, folderId, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function close() {
    if (upload.mode === 'excel' && upload.job?.id && upload.job.status !== 'COMPLETED') api(`/admin/imports/${upload.job.id}/cancel`, { method: 'POST' }).catch(() => {})
    setUpload(null)
  }

  async function inspectSheet() {
    setBusy(true); setError('')
    try {
      const job = await api(`/admin/imports/${upload.job.id}/inspect`, { method: 'POST', body: JSON.stringify({ sheetName: upload.sheetName }) })
      setUpload(current => ({ ...current, job }))
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function confirm() {
    setBusy(true); setError('')
    try {
      if (upload.mode === 'document') {
        const body = new FormData()
        body.append('file', upload.file)
        body.append('title', upload.title.trim())
        body.append('categoryId', folderId)
        body.append('accessLevel', upload.accessLevel)
        await api('/admin/documents', { method: 'POST', body })
      } else {
        const job = await api(`/admin/imports/${upload.job.id}/commit`, { method: 'POST', body: JSON.stringify({ collectionName: upload.collectionName.trim(), defaultAccessLevel: upload.accessLevel }) })
        setUpload(current => ({ ...current, job }))
      }
      onDone()
      setUpload(null)
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  const inspection = upload.job?.inspection || {}
  const preview = inspection.preview || []
  const fields = inspection.fields || []
  const needsSheet = Boolean(inspection.requiresSheetSelection)
  return <div className="fm-dialog-backdrop">
    <section className="fm-dialog fm-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title">
      <header><div><small>Add File</small><h2 id="upload-dialog-title">{upload.mode === 'excel' ? 'Import Excel Data' : 'Upload Document'}</h2></div><button onClick={close} disabled={busy} aria-label="ပိတ်ရန်"><CloseRounded /></button></header>
      <div className="fm-dialog-body">
        <p className="fm-dialog-note">{upload.mode === 'excel' ? <TableChartRounded /> : upload.file.type === 'application/pdf' ? <PictureAsPdfRounded /> : <ImageRounded />}<span><b>{upload.file?.name || upload.job?.originalFileName}</b><small>{upload.mode === 'excel' ? 'Database ထဲသို့ structured data အဖြစ် import လုပ်မည်' : 'ရွေးထားသည့် Folder ထဲသို့ upload လုပ်မည်'}</small></span></p>
        {upload.mode === 'document' ? <>
          <label className="fm-field">Title<input value={upload.title} onChange={event => setUpload(current => ({ ...current, title: event.target.value }))} autoFocus /></label>
          <label className="fm-field">Access<select value={upload.accessLevel} onChange={event => setUpload(current => ({ ...current, accessLevel: event.target.value }))}><option value="NORMAL">Normal</option><option value="VIP">VIP</option><option value="ADMIN">Admin only</option></select></label>
        </> : <>
          {needsSheet ? <div className="fm-sheet-select"><label className="fm-field">Worksheet<select value={upload.sheetName} onChange={event => setUpload(current => ({ ...current, sheetName: event.target.value }))}>{inspection.sheets?.map(sheet => <option key={sheet.name}>{sheet.name}</option>)}</select></label><button onClick={inspectSheet} disabled={busy}>Preview sheet</button></div> : <>
            <label className="fm-field">Data name<input value={upload.collectionName} onChange={event => setUpload(current => ({ ...current, collectionName: event.target.value }))} /></label>
            <label className="fm-field">Access<select value={upload.accessLevel} onChange={event => setUpload(current => ({ ...current, accessLevel: event.target.value }))}><option value="NORMAL">Normal</option><option value="VIP">VIP</option><option value="ADMIN">Admin only</option></select></label>
            <div className="fm-import-summary"><span><b>{upload.job.validRows || 0}</b> valid rows</span><span className={upload.job.invalidRows ? 'danger' : ''}><b>{upload.job.invalidRows || 0}</b> invalid rows</span><span><b>{fields.length}</b> fields</span></div>
            {preview.length > 0 && <div className="fm-preview-table"><table><thead><tr><th>#</th>{fields.map(field => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{preview.slice(0, 6).map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td>{fields.map(field => <td key={field.key}>{String(row.data[field.key] ?? '')}</td>)}</tr>)}</tbody></table></div>}
          </>}
        </>}
        {error && <p className="fm-error" role="alert">{error}</p>}
      </div>
      <footer><button onClick={close} disabled={busy}>Cancel</button><button className="primary" onClick={confirm} disabled={busy || (upload.mode === 'document' ? !upload.title.trim() : needsSheet || !upload.collectionName.trim() || upload.job.invalidRows > 0)}>{busy ? 'Working…' : upload.mode === 'excel' ? 'Import data' : 'Upload'}</button></footer>
    </section>
  </div>
}

function ContextMenu({ menu, onClose, onOpen, onRename, onMove, onCut, onDetails }) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('resize', close) }
  }, [onClose])
  return <div className="fm-context-menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()} role="menu">
    <button onClick={onOpen}><OpenInNewRounded />Open</button>
    <button onClick={onRename}><EditOutlined />Rename</button>
    <button onClick={onMove}><DriveFileMoveOutlined />Move to…</button>
    <button onClick={onCut}><ContentCutRounded />Cut <kbd>Ctrl + X</kbd></button>
    <button onClick={onDetails}><InfoOutlined />Details</button>
  </div>
}

export default function Categories({ onViewData }) {
  const queryClient = useQueryClient()
  const categoryMutation = useCategoryMutation()
  const fileInput = useRef(null)
  const newFolderBlurAction = useRef('')
  const renameBlurAction = useRef('')
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [selection, setSelection] = useState(new Set())
  const [cutItems, setCutItems] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [view, setView] = useState('list')
  const [newFolder, setNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [rename, setRename] = useState(null)
  const [menu, setMenu] = useState(null)
  const [moveItems, setMoveItems] = useState(null)
  const [detailsItem, setDetailsItem] = useState(null)
  const [upload, setUpload] = useState(null)
  const [uploadFolderId, setUploadFolderId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const treeQuery = useCategoryTree()
  const contentsQuery = useFolderContents(selectedFolderId)
  const tree = useMemo(() => treeQuery.data || [], [treeQuery.data])
  const contents = useMemo(() => selectedFolderId ? contentsQuery.data : { folders: tree, dataItems: [], documents: [], breadcrumb: [] }, [contentsQuery.data, selectedFolderId, tree])
  const allItems = useMemo(() => normalizeFileManagerItems(contents || {}), [contents])
  const visibleItems = useMemo(() => filterAndSortItems(allItems, search, sortBy), [allItems, search, sortBy])
  const selectedItems = useMemo(() => allItems.filter(item => selection.has(itemKey(item))), [allItems, selection])
  const location = selectedFolderId ? `Home / ${(contents?.breadcrumb || []).map(item => item.name).join(' / ')}` : 'Home'
  const cutKeys = useMemo(() => new Set(cutItems.map(itemKey)), [cutItems])
  const displayedExpanded = useMemo(() => expanded.size ? expanded : new Set(tree.map(folder => folder.id)), [expanded, tree])
  const canManage = user().role === 'ADMIN'
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: categoryKeys.all })
  }

  function toggleTree(id) {
    setExpanded(current => { const next = new Set(current.size ? current : tree.map(folder => folder.id)); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function navigateToFolder(id) {
    setSelectedFolderId(id)
    setSelection(new Set())
    setMenu(null)
    setNewFolder(false)
    setRename(null)
    setSearch('')
  }

  function selectItem(event, item) {
    const key = itemKey(item)
    setSelection(current => {
      if (!event.ctrlKey && !event.metaKey) return new Set([key])
      const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next
    })
  }

  async function openItem(item) {
    setMenu(null)
    if (item.itemType === 'FOLDER') { navigateToFolder(item.id); return }
    if (item.itemType === 'DATA') { onViewData?.(item.categoryId, item.id); return }
    try {
      const blob = await apiBlob(`/documents/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (requestError) { setError(requestError.message) }
  }

  function openMenu(event, item) {
    event.preventDefault(); event.stopPropagation()
    const key = itemKey(item)
    if (!selection.has(key)) setSelection(new Set([key]))
    const x = Math.min(event.clientX, window.innerWidth - 210)
    const y = Math.min(event.clientY, window.innerHeight - 250)
    setMenu({ x, y, item })
  }

  async function createFolder() {
    const name = newFolderName.trim()
    setNewFolder(false); setNewFolderName('')
    if (!name) return
    try {
      await categoryMutation.mutateAsync({ mode: selectedFolderId ? 'child' : 'root', category: { id: selectedFolderId }, values: { name, ...(selectedFolderId ? { parentId: selectedFolderId } : {}) } })
      setNotice('Folder created')
    } catch (requestError) { setError(requestError.message) }
  }

  async function renameItem(item, name) {
    const cleanName = name.trim()
    setRename(null)
    if (!cleanName || cleanName === item.name) return
    setBusy(true); setError('')
    try {
      if (item.itemType === 'FOLDER') await categoryMutation.mutateAsync({ mode: 'edit', category: item, values: { name: cleanName } })
      else if (item.itemType === 'DATA') await api(`/admin/data/collections/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: cleanName }) })
      else await api(`/admin/documents/${item.id}`, { method: 'PATCH', body: JSON.stringify({ title: cleanName }) })
      await refresh(); setNotice('Renamed successfully')
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function move(item, targetFolderId) {
    if (item.itemType === 'FOLDER') return categoryMutation.mutateAsync({ mode: 'move', category: item, values: { parentId: targetFolderId || null } })
    if (!targetFolderId) throw new Error('Data နှင့် Document ကို Home root သို့ မရွှေ့နိုင်ပါ။ Folder တစ်ခုရွေးပါ။')
    if (item.itemType === 'DATA') return api(`/admin/data/collections/${item.id}`, { method: 'PATCH', body: JSON.stringify({ categoryId: targetFolderId }) })
    return api(`/admin/documents/${item.id}`, { method: 'PATCH', body: JSON.stringify({ categoryId: targetFolderId }) })
  }

  async function confirmMove(targetFolderId, items = moveItems || []) {
    setBusy(true); setError('')
    try {
      for (const item of items) await move(item, targetFolderId)
      setMoveItems(null); setCutItems([]); setSelection(new Set()); await refresh(); setNotice('Items moved successfully')
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  function startRename(item = selectedItems[0]) {
    if (!item || selectedItems.length > 1) return
    renameBlurAction.current = ''
    setMenu(null); setRename({ key: itemKey(item), name: item.name, item })
  }

  function cut(items = selectedItems) {
    if (!items.length) return
    setCutItems(items); setMenu(null); setNotice(`${items.length} item cut — destination Folder တွင် Ctrl + V နှိပ်ပါ`)
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !uploadFolderId) return
    setError('')
    if (file.name.toLocaleLowerCase().endsWith('.xlsx')) {
      setBusy(true)
      try {
        const body = new FormData(); body.append('file', file); body.append('categoryId', uploadFolderId)
        const job = await api('/admin/imports/excel/inspect', { method: 'POST', body })
        setUpload({ mode: 'excel', file, job, collectionName: file.name.replace(/\.xlsx$/i, ''), accessLevel: 'NORMAL', sheetName: job.inspection?.sheets?.[0]?.name || '' })
      } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
    } else {
      setUpload({ mode: 'document', file, title: file.name.replace(/\.(pdf|jpe?g)$/i, ''), accessLevel: 'NORMAL' })
    }
  }

  function requestAddFile() {
    const selectedFolder = selectedItems.length === 1 && selectedItems[0].itemType === 'FOLDER' ? selectedItems[0].id : null
    const targetFolderId = selectedFolderId || selectedFolder
    if (!targetFolderId) { setNotice('ဖိုင်ထည့်မည့် Folder ကို အရင်ရွေးပါ'); return }
    setUploadFolderId(targetFolderId)
    fileInput.current?.click()
  }

  function requestMove() {
    if (!selectedItems.length) { setNotice('ရွှေ့လိုသည့် item ကို အရင်ရွေးပါ'); return }
    setMoveItems(selectedItems)
  }

  useEffect(() => {
    const keydown = event => {
      if (isEditingTarget(event.target)) return
      const command = event.ctrlKey || event.metaKey
      if (command && event.shiftKey && event.key.toLocaleLowerCase() === 'n') { event.preventDefault(); if (canManage) { newFolderBlurAction.current = ''; setNewFolder(true); setNewFolderName('') } }
      else if (command && event.key.toLocaleLowerCase() === 'a') { event.preventDefault(); setSelection(new Set(visibleItems.map(itemKey))) }
      else if (command && event.key.toLocaleLowerCase() === 'x') { event.preventDefault(); cut() }
      else if (command && event.key.toLocaleLowerCase() === 'v') { event.preventDefault(); if (cutItems.length) confirmMove(selectedFolderId, cutItems) }
      else if (event.key === 'F2') { event.preventDefault(); startRename() }
      else if (event.key === 'Enter' && selectedItems.length === 1) { event.preventDefault(); openItem(selectedItems[0]) }
      else if (event.key === 'Escape') { newFolderBlurAction.current = 'cancel'; renameBlurAction.current = 'cancel'; setSelection(new Set()); setCutItems([]); setMenu(null); setNewFolder(false); setRename(null) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  const loading = treeQuery.isLoading || (selectedFolderId && contentsQuery.isLoading)
  const pageError = treeQuery.error || contentsQuery.error
  return <section className="file-manager" onClick={() => setMenu(null)}>
    <aside className="fm-sidebar">
      <h2>Folders</h2>
      <div className={`fm-tree-row home ${selectedFolderId === null ? 'selected' : ''}`}><span className="fm-tree-spacer" /><button className="fm-tree-name" onClick={() => navigateToFolder(null)}><HomeRounded /><span>Home</span></button></div>
      <div className="fm-tree-scroll">
        {treeQuery.isLoading ? <div className="fm-tree-loading"><i /><i /><i /><i /></div> : tree.length ? <FolderTree nodes={tree} selectedId={selectedFolderId} expanded={displayedExpanded} onToggle={toggleTree} onSelect={navigateToFolder} /> : <p className="fm-empty-tree">Folder မရှိသေးပါ</p>}
      </div>
    </aside>

    <main className="fm-main">
      <div className="fm-toolbar">
        <div className="fm-toolbar-primary">
          <button className="primary" onClick={() => { newFolderBlurAction.current = ''; setNewFolder(true); setNewFolderName('') }} disabled={!canManage}><CreateNewFolderOutlined />New Folder<KeyboardArrowDownRounded /></button>
          <button onClick={requestAddFile} disabled={!canManage || busy}><UploadFileRounded />Add File<KeyboardArrowDownRounded /></button>
          <input ref={fileInput} type="file" accept=".xlsx,.pdf,.jpg,.jpeg" onChange={chooseFile} hidden />
          <button onClick={requestMove} disabled={!canManage}><DriveFileMoveOutlined />Move to</button>
        </div>
        <div className="fm-toolbar-tools">
          <label className="fm-search"><SearchRounded /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search in this folder…" /></label>
          <label className="fm-sort"><SortRounded /><span>Sort</span><select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort items"><option value="name">Name</option><option value="type">Type</option><option value="updated">Last Modified</option></select><KeyboardArrowDownRounded /></label>
          <div className="fm-view-toggle"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><ViewListRounded /></button><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><GridViewRounded /></button></div>
        </div>
      </div>

      <div className="fm-content" onClick={event => event.target === event.currentTarget && setSelection(new Set())}>
        {error && <div className="fm-inline-error" role="alert"><span>{error}</span><button onClick={() => setError('')}><CloseRounded /></button></div>}
        {pageError ? <div className="fm-state error"><InfoOutlined /><b>Folder contents မဖွင့်နိုင်ပါ</b><span>{pageError.message}</span><button onClick={() => { treeQuery.refetch(); contentsQuery.refetch() }}>Try again</button></div>
          : loading ? <div className="fm-list-loading"><i /><i /><i /><i /><i /></div>
            : view === 'list' ? <div className="fm-list" role="grid" aria-label="Current folder contents">
              <div className="fm-list-head" role="row"><span>Name</span><span>Type</span><span>Size / Records</span><span>Last Modified</span><span>Modified By</span><span /></div>
              {newFolder && <div className="fm-row editing"><span className="fm-name-cell"><span className="fm-item-icon folder"><FolderRounded /></span><input value={newFolderName} onChange={event => setNewFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); newFolderBlurAction.current = 'save'; createFolder() } if (event.key === 'Escape') { newFolderBlurAction.current = 'cancel'; setNewFolder(false) } }} onBlur={() => { if (newFolderBlurAction.current) { newFolderBlurAction.current = ''; return } createFolder() }} autoFocus placeholder="New folder" /></span><span>Folder</span><span>0 items</span><span>—</span><span>{user().name || 'Administrator'}</span><span /></div>}
              {visibleItems.map(item => {
                const key = itemKey(item); const selected = selection.has(key); const editing = rename?.key === key
                return <div className={`fm-row ${selected ? 'selected' : ''} ${cutKeys.has(key) ? 'cut' : ''}`} role="row" tabIndex={0} key={key} onClick={event => selectItem(event, item)} onDoubleClick={() => openItem(item)} onContextMenu={event => openMenu(event, item)}>
                  <span className="fm-name-cell"><span className={`fm-item-icon ${item.itemType.toLowerCase()}`}><ItemIcon type={item.itemType} /></span>{editing ? <input value={rename.name} onChange={event => setRename(current => ({ ...current, name: event.target.value }))} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Enter') { renameBlurAction.current = 'save'; renameItem(item, rename.name) } if (event.key === 'Escape') { renameBlurAction.current = 'cancel'; setRename(null) } }} onBlur={() => { if (renameBlurAction.current) { renameBlurAction.current = ''; return } renameItem(item, rename.name) }} autoFocus /> : <b>{item.name}</b>}</span>
                  <span><em className={`fm-type ${item.itemType.toLowerCase()}`}>{item.typeLabel}</em></span><span>{item.sizeLabel}</span><span>{formatDate(item.updatedAt)}</span><span>{item.modifiedBy}</span>
                  <span><button className="fm-kebab" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); openMenu({ ...event, clientX: rect.right - 8, clientY: rect.bottom + 4, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() }, item) }} aria-label={`${item.name} actions`}><MoreVertRounded /></button></span>
                </div>
              })}
              {!newFolder && !visibleItems.length && <div className="fm-state"><FolderOpenRounded /><b>This folder is empty</b><span>New Folder ဖန်တီးပါ သို့မဟုတ် File ထည့်ပါ</span></div>}
            </div> : <div className="fm-grid">
              {newFolder && <article className="fm-grid-card editing"><span className="fm-item-icon folder"><FolderRounded /></span><input value={newFolderName} onChange={event => setNewFolderName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { newFolderBlurAction.current = 'save'; createFolder() } if (event.key === 'Escape') { newFolderBlurAction.current = 'cancel'; setNewFolder(false) } }} onBlur={() => { if (newFolderBlurAction.current) { newFolderBlurAction.current = ''; return } createFolder() }} autoFocus placeholder="New folder" /></article>}
              {visibleItems.map(item => { const key = itemKey(item); return <article key={key} className={`fm-grid-card ${selection.has(key) ? 'selected' : ''} ${cutKeys.has(key) ? 'cut' : ''}`} onClick={event => selectItem(event, item)} onDoubleClick={() => openItem(item)} onContextMenu={event => openMenu(event, item)}><span className={`fm-item-icon ${item.itemType.toLowerCase()}`}><ItemIcon type={item.itemType} /></span><div>{rename?.key === key ? <input value={rename.name} onChange={event => setRename(current => ({ ...current, name: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { renameBlurAction.current = 'save'; renameItem(item, rename.name) } if (event.key === 'Escape') { renameBlurAction.current = 'cancel'; setRename(null) } }} onBlur={() => { if (renameBlurAction.current) { renameBlurAction.current = ''; return } renameItem(item, rename.name) }} autoFocus /> : <b>{item.name}</b>}<small>{item.typeLabel} · {item.sizeLabel}</small></div><button className="fm-kebab" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); openMenu({ ...event, clientX: rect.right - 8, clientY: rect.bottom + 4, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() }, item) }}><MoreVertRounded /></button></article>})}
            </div>}
      </div>
      <footer className="fm-status"><span>{visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}{selection.size ? ` · ${selection.size} selected` : ''}</span><div><span><kbd>Ctrl + A</kbd> Select all</span><span><kbd>Ctrl + X</kbd> Cut</span><span><kbd>Ctrl + V</kbd> Paste (Move)</span><span><kbd>Ctrl + Shift + N</kbd> New Folder</span><span><kbd>F2</kbd> Rename</span><span><kbd>Enter</kbd> Open</span></div></footer>
    </main>

    {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} onOpen={() => openItem(menu.item)} onRename={() => startRename(menu.item)} onMove={() => { setMoveItems(selection.has(itemKey(menu.item)) ? selectedItems : [menu.item]); setMenu(null) }} onCut={() => cut(selection.has(itemKey(menu.item)) ? selectedItems : [menu.item])} onDetails={() => { setDetailsItem(menu.item); setMenu(null) }} />}
    {moveItems && <MoveDialog items={moveItems} tree={tree} onClose={() => { setMoveItems(null); setError('') }} onConfirm={confirmMove} busy={busy} error={error} />}
    {detailsItem && <DetailsDialog item={detailsItem} location={location} onClose={() => setDetailsItem(null)} />}
    {upload && <UploadDialog upload={upload} setUpload={setUpload} folderId={uploadFolderId} onDone={async () => { await refresh(); setNotice('File added successfully') }} />}
    {notice && <div className="fm-toast">{notice}</div>}
  </section>
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

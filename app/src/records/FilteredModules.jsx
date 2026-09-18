import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AddRounded from '@mui/icons-material/AddRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined'
import DashboardCustomizeOutlined from '@mui/icons-material/DashboardCustomizeOutlined'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import FilterListRounded from '@mui/icons-material/FilterListRounded'
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import StorageRounded from '@mui/icons-material/StorageRounded'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { api, apiBlob, apiEnvelope } from '../api.js'
import { useCategoryTree } from '../categories/category-queries.js'
import { createRecordRequest, fieldInputType, filterFolderTree, recordQueryParams } from './data-workspace-utils.js'
import './filtered-modules.css'
import './data-workspace.css'

const admin = () => JSON.parse(sessionStorage.getItem('office_user') || '{}').role === 'ADMIN'
const formatDate = value => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'

function FolderTree({ nodes, selectedId, expanded, onToggle, onSelect, depth = 0 }) {
  return nodes.map(node => {
    const open = expanded.has(node.id)
    const children = node.children || []
    return <div className="data-tree-branch" key={node.id}>
      <div className={`data-tree-row ${selectedId === node.id ? 'selected' : ''}`} style={{ '--depth': depth }}>
        <button className="data-tree-toggle" onClick={() => children.length && onToggle(node.id)} disabled={!children.length}>{children.length && (open ? <ExpandMoreRounded /> : <ChevronRightRounded />)}</button>
        <button className="data-tree-name" onClick={() => onSelect(node)}>{open ? <FolderOpenRounded /> : <FolderRounded />}<span>{node.name}</span></button>
      </div>
      {open && children.length > 0 && <FolderTree nodes={children} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} depth={depth + 1} />}
    </div>
  })
}

function Modal({ title, eyebrow, children, actions, onClose, wide = false }) {
  return <div className="data-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className={`data-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true"><header><div><small>{eyebrow}</small><h2>{title}</h2></div><button onClick={onClose}><CloseRounded /></button></header><div className="data-modal-body">{children}</div>{actions && <footer>{actions}</footer>}</section></div>
}

export function DynamicField({ field, value, onChange, disabled = false }) {
  const common = { id: `field-${field.id}`, disabled, required: field.required }
  if (field.type === 'BOOLEAN') return <label className="data-switch"><input {...common} type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} /><span />{field.label}{field.required && <em>*</em>}</label>
  if (field.type === 'ENUM') return <label>{field.label}{field.required && <em>*</em>}<select {...common} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">ရွေးချယ်ပါ</option>{(field.options || []).map(option => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>
  return <label>{field.label}{field.required && <em>*</em>}<input {...common} type={fieldInputType(field.type)} value={field.type === 'DATE' && value ? String(value).slice(0, 10) : value ?? ''} onChange={event => onChange(event.target.value)} /></label>
}

export function RecordDialog({ tree, initialCategory, initialCollection, record, onClose, onSaved, refreshTree }) {
  const editing = Boolean(record)
  const [step, setStep] = useState(editing || initialCollection ? 'form' : 'location')
  const [folder, setFolder] = useState(initialCategory || null)
  const [collection, setCollection] = useState(initialCollection || record?.dataCollection || null)
  const [collections, setCollections] = useState([])
  const [folderSearch, setFolderSearch] = useState('')
  const [expanded, setExpanded] = useState(new Set(tree.map(item => item.id)))
  const [newFolder, setNewFolder] = useState('')
  const [title, setTitle] = useState(record?.title || '')
  const [view, setView] = useState(record?.accessLevel || collection?.defaultAccessLevel || 'NORMAL')
  const [payload, setPayload] = useState(record?.payload || {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const filteredTree = useMemo(() => filterFolderTree(tree, folderSearch), [folderSearch, tree])

  useEffect(() => {
    if (!folder?.id || editing) return
    let active = true
    api(`/data/collections?categoryId=${encodeURIComponent(folder.id)}`).then(items => active && setCollections(items)).catch(requestError => active && setError(requestError.message))
    return () => { active = false }
  }, [editing, folder?.id])

  async function createFolder() {
    if (!newFolder.trim()) return
    setBusy(true); setError('')
    try {
      const created = await api('/admin/categories', { method: 'POST', body: JSON.stringify({ name: newFolder.trim(), ...(folder?.id ? { parentId: folder.id } : {}) }) })
      await refreshTree(); setFolder(created); setNewFolder('')
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function save() {
    if (!collection || !title.trim()) return
    setBusy(true); setError('')
    try {
      const body = { title: title.trim(), accessLevel: view, payload }
      if (editing) await api(`/admin/data/${record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      else await createRecordRequest({ ...body, categoryId: folder.id, dataCollectionId: collection.id })
      onSaved()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  const fields = collection?.fields || []
  return <Modal wide title={editing ? 'မှတ်တမ်းပြင်ဆင်ရန်' : 'Add New'} eyebrow="Structured Data" onClose={onClose} actions={<><button onClick={onClose}>Cancel</button><button className="primary" onClick={save} disabled={busy || !collection || !title.trim()}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add New'}</button></>}>
    {!editing && <section className="data-location-card"><div><small>Location</small><b>{folder ? `Home / ${folder.name}` : 'Folder ရွေးချယ်ရန်'}</b></div><button onClick={() => setStep('location')}>Change</button><div><small>Data File</small><b>{collection?.name || 'Structured Data ရွေးချယ်ရန်'}</b></div></section>}
    {!editing && step === 'location' && <div className="data-location-picker"><div className="data-picker-tree"><label><SearchRounded /><input value={folderSearch} onChange={event => setFolderSearch(event.target.value)} placeholder="Folder ရှာရန်…" /></label><div><FolderTree nodes={filteredTree} selectedId={folder?.id} expanded={expanded} onToggle={id => setExpanded(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })} onSelect={node => { setFolder(node); setCollection(null) }} /></div><div className="data-new-folder"><input value={newFolder} onChange={event => setNewFolder(event.target.value)} placeholder="Folder အသစ်အမည်" /><button onClick={createFolder} disabled={busy || !newFolder.trim()}><CreateNewFolderOutlined />New Folder</button></div></div><div className="data-picker-files"><h3>Data File</h3>{folder ? collections.map(item => <button key={item.id} className={collection?.id === item.id ? 'selected' : ''} onClick={() => { setCollection(item); setView(item.defaultAccessLevel); setPayload({}); setStep('form') }}><StorageRounded /><span><b>{item.name}</b><small>{item._count?.records || 0} records · {item.fields?.length || 0} fields</small></span></button>) : <p>Folder တစ်ခုရွေးပါ</p>}{folder && !collections.length && <p>ဤ Folder တွင် Structured Data မရှိသေးပါ</p>}</div></div>}
    {(editing || step === 'form') && collection && <div className="data-record-form"><label>ခေါင်းစဉ် <em>*</em><input value={title} onChange={event => setTitle(event.target.value)} autoFocus /></label><label>View<select value={view} onChange={event => setView(event.target.value)}><option value="NORMAL">Normal</option><option value="VIP">VIP</option></select></label><div className="data-dynamic-fields">{fields.map(field => <DynamicField key={field.id} field={field} value={payload[field.key]} onChange={value => setPayload(current => ({ ...current, [field.key]: value }))} />)}</div></div>}
    {error && <p className="data-error">{error}</p>}
  </Modal>
}

function DashboardDialog({ collection, onClose }) {
  const numeric = collection.fields.filter(field => field.type === 'NUMBER')
  const dimensions = collection.fields.filter(field => ['TEXT', 'ENUM', 'DATE'].includes(field.type))
  const [form, setForm] = useState({ title: `${collection.name} Dashboard`, chartType: 'KPI', dimensionFieldId: '', measureFieldId: '', aggregation: 'COUNT', timeGrouping: '', accessLevel: 'NORMAL' })
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  async function save() {
    setBusy(true); setError('')
    try {
      const created = await api('/admin/dashboard-widgets', { method: 'POST', body: JSON.stringify({ ...form, dataCollectionId: collection.id, dimensionFieldId: form.dimensionFieldId || null, measureFieldId: form.measureFieldId || null, timeGrouping: form.timeGrouping || null, sortOrder: 0, isActive: true }) })
      setPreview(await api(`/admin/dashboard-widgets/${created.id}/preview`))
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return <Modal title="Dashboard Widget" eyebrow={collection.name} onClose={onClose} actions={<><button onClick={onClose}>{preview ? 'Done' : 'Cancel'}</button><button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & Preview'}</button></>}><div className="data-record-form"><label>Title<input value={form.title} onChange={event => set('title', event.target.value)} /></label><label>Chart Type<select value={form.chartType} onChange={event => set('chartType', event.target.value)}>{['KPI','PIE','BAR','LINE','CATEGORY_SUMMARY'].map(item => <option key={item}>{item}</option>)}</select></label>{['PIE','BAR','LINE'].includes(form.chartType) && <label>Dimension<select value={form.dimensionFieldId} onChange={event => set('dimensionFieldId', event.target.value)}><option value="">ရွေးချယ်ပါ</option>{dimensions.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>}<label>Aggregation<select value={form.aggregation} onChange={event => set('aggregation', event.target.value)}>{['COUNT','SUM','AVG','MIN','MAX'].map(item => <option key={item}>{item}</option>)}</select></label>{form.aggregation !== 'COUNT' && <label>Measure<select value={form.measureFieldId} onChange={event => set('measureFieldId', event.target.value)}><option value="">ရွေးချယ်ပါ</option>{numeric.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>}{form.chartType === 'LINE' && <label>Time Grouping<select value={form.timeGrouping} onChange={event => set('timeGrouping', event.target.value)}>{['DAY','MONTH','QUARTER','YEAR'].map(item => <option key={item}>{item}</option>)}</select></label>}<label>View<select value={form.accessLevel} onChange={event => set('accessLevel', event.target.value)}><option value="NORMAL">Normal</option><option value="VIP">VIP</option></select></label></div>{preview && <pre className="data-widget-preview">{JSON.stringify(preview.data, null, 2)}</pre>}{error && <p className="data-error">{error}</p>}</Modal>
}

function RecordMenu({ position, onClose, onView, onEdit, onDelete }) {
  useEffect(() => { const close = () => onClose(); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [onClose])
  return <div className="data-row-menu" style={position} onClick={event => event.stopPropagation()}><button onClick={onView}><VisibilityOutlined />View</button><button onClick={onEdit}><EditOutlined />Edit</button><button onClick={onView}><InfoOutlined />Details</button><hr/><button className="danger" onClick={onDelete}><DeleteOutlineRounded />Delete</button></div>
}

export function DataRecordsPage({ categoryId, dataCollectionId = null }) {
  const treeQuery = useCategoryTree()
  const tree = useMemo(() => treeQuery.data || [], [treeQuery.data])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [folderSearch, setFolderSearch] = useState('')
  const [collections, setCollections] = useState({ loading: false, items: [], error: '' })
  const [collection, setCollection] = useState(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [filterOptions, setFilterOptions] = useState({})
  const [sort, setSort] = useState({ sortBy: 'updatedAt', sortDirection: 'desc' })
  const [records, setRecords] = useState({ loading: false, items: [], nextCursor: null, error: '' })
  const [recordRevision, setRecordRevision] = useState(0)
  const [dialog, setDialog] = useState(null)
  const [menu, setMenu] = useState(null)
  const [notice, setNotice] = useState('')
  const sentinel = useRef(null)

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer) }, [search])
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 2500); return () => clearTimeout(timer) } }, [notice])
  useEffect(() => {
    if (!tree.length || selectedFolder) return
    const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])])
    const targetFolder = flatten(tree).find(node => node.id === categoryId) || tree[0]
    if (targetFolder) {
      setSelectedFolder(targetFolder)
      setExpanded(new Set(tree.map(item => item.id)))
    }
  }, [categoryId, selectedFolder, tree])
  useEffect(() => {
    if (!selectedFolder?.id) return
    let active = true
    setCollections(current => ({ ...current, loading: true, error: '' }))
    Promise.all([api(`/data/collections?categoryId=${encodeURIComponent(selectedFolder.id)}`), api(`/categories/${selectedFolder.id}`)]).then(([items, details]) => { if (!active) return; setCollections({ loading: false, items, error: '' }); setBreadcrumb(details.breadcrumb || []); setCollection(current => current && current.categoryId !== selectedFolder.id ? null : current) }).catch(error => active && setCollections({ loading: false, items: [], error: error.message }))
    return () => { active = false }
  }, [selectedFolder?.id])
  useEffect(() => {
    if (!dataCollectionId || collection?.id === dataCollectionId) return
    api(`/data/collections/${dataCollectionId}`).then(item => {
      setCollection(item)
      const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])])
      const targetFolder = flatten(tree).find(node => node.id === item.categoryId)
      if (targetFolder) setSelectedFolder(targetFolder)
    }).catch(() => {})
  }, [collection?.id, dataCollectionId, tree])
  useEffect(() => {
    if (!showFilters || !collection) return undefined
    let active = true
    const optionFields = collection.fields.filter(field => field.type === 'ENUM')
    Promise.all(optionFields.map(async field => [field.key, await api(`/data/collections/${collection.id}/filter-options/${encodeURIComponent(field.key)}`)])).then(entries => active && setFilterOptions(Object.fromEntries(entries))).catch(() => {})
    return () => { active = false }
  }, [collection, showFilters])

  const loadRecords = useCallback(async (cursor = null, append = false) => {
    if (!collection) return
    setRecords(current => ({ ...current, loading: true, error: '' }))
    try {
      const params = recordQueryParams({ dataCollectionId: collection.id, search: debouncedSearch, filters, sortBy: sort.sortBy, sortDirection: sort.sortDirection, cursor })
      const response = await apiEnvelope(`/data?${params}`)
      setRecords(current => ({ loading: false, items: append ? [...current.items, ...response.data] : response.data, nextCursor: response.meta?.nextCursor || null, error: '' }))
    } catch (error) { setRecords(current => ({ ...current, loading: false, error: error.message })) }
  }, [collection, debouncedSearch, filters, sort.sortBy, sort.sortDirection])
  useEffect(() => { if (collection) loadRecords() }, [collection, loadRecords, recordRevision])
  useEffect(() => {
    const node = sentinel.current
    if (!node || !records.nextCursor || records.loading) return undefined
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadRecords(records.nextCursor, true) }, { rootMargin: '160px' })
    observer.observe(node); return () => observer.disconnect()
  }, [records.nextCursor, records.loading, loadRecords])

  const filteredTree = useMemo(() => filterFolderTree(tree, folderSearch), [folderSearch, tree])
  const changeFolder = node => { setSelectedFolder(node); setCollection(null); setSelectedCollectionId(null); setSearch(''); setFilters({}) }
  const openCollection = item => { setCollection(item); setSearch(''); setFilters({}) }
  const closeDialog = () => setDialog(null)
  const refreshRecords = () => { closeDialog(); setMenu(null); setRecordRevision(value => value + 1); setNotice('Saved successfully') }
  const archiveRecord = async record => { if (!window.confirm('This record will be deleted. Continue?')) return; try { await api(`/admin/data/${record.id}/archive`, { method: 'POST' }); refreshRecords() } catch (error) { setNotice(error.message) } }
  const exportRecords = async () => { if (!collection) return; const params = new URLSearchParams({ dataCollectionId: collection.id, categoryId: selectedFolder.id, format: 'xlsx', ...(Object.keys(filters).length ? { filters: JSON.stringify(filters) } : {}) }); try { const blob = await apiBlob(`/reports/export?${params}`); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${collection.name}.xlsx`; link.click(); URL.revokeObjectURL(url) } catch (error) { setNotice(error.message) } }

  return <section className="data-workspace">
    <aside className="data-sidebar"><label className="data-folder-search"><SearchRounded /><input value={folderSearch} onChange={event => setFolderSearch(event.target.value)} placeholder="Folder များ ရှာဖွေ…" /></label><div className="data-tree-home"><HomeRounded /><span>Home</span></div><div className="data-tree-scroll">{treeQuery.isLoading ? <p>Folder များဖွင့်နေသည်…</p> : <FolderTree nodes={filteredTree} selectedId={selectedFolder?.id} expanded={expanded} onToggle={id => setExpanded(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })} onSelect={changeFolder} />}</div></aside>
    <main className="data-main">
      <header className="data-topbar"><nav><button onClick={() => { setCollection(null); setSelectedFolder(tree[0] || null) }}><HomeRounded /></button>{breadcrumb.map(item => <span key={item.id}><NavigateNextRounded />{item.name}</span>)}{collection && <span><NavigateNextRounded />{collection.name}</span>}</nav><button className="data-add" onClick={() => setDialog({ type: 'record', record: null })} disabled={!admin()}><AddRounded />Add New</button></header>
      {!collection ? <section className="data-collection-list"><div className="data-list-head"><span>Name</span><span>Type</span><span>Records</span><span>Last Updated</span><span /></div>{collections.loading ? <div className="data-empty">Structured Data ဖွင့်နေသည်…</div> : collections.error ? <div className="data-empty error">{collections.error}</div> : collections.items.map(item => <div className={`data-collection-row ${selectedCollectionId === item.id ? 'selected' : ''}`} key={item.id} tabIndex={0} onClick={() => setSelectedCollectionId(item.id)} onDoubleClick={() => openCollection(item)}><span><i><StorageRounded /></i><b>{item.name}</b></span><span>Structured Data</span><span>{(item._count?.records || 0).toLocaleString()}</span><span>{formatDate(item.updatedAt)}</span><button onClick={event => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setMenu({ kind: 'collection', item, position: { right: window.innerWidth - rect.right, top: rect.bottom + 4 } }) }}><MoreVertRounded /></button></div>)}{!collections.loading && !collections.error && !collections.items.length && <div className="data-empty"><StorageRounded /><b>Structured Data မရှိသေးပါ</b><span>အခြား Folder ရွေးပါ သို့မဟုတ် Add New မှ မှတ်တမ်းထည့်ပါ။</span></div>}</section> : <section className="data-records-view">
        <div className="data-records-title"><button onClick={() => setCollection(null)}><ArrowBackRounded /></button><div><small>Structured Data</small><h1>{collection.name}</h1><p>{collection.description || `${collection.fields.length} fields · ${collection._count?.records || 0} records`}</p></div></div>
        <div className="data-record-toolbar"><div><button className="primary" onClick={() => setDialog({ type: 'record', record: null })}><AddRounded />Add New</button><button onClick={() => setDialog({ type: 'dashboard' })}><DashboardCustomizeOutlined />Dashboard</button><button onClick={exportRecords}><DownloadRounded />Export</button></div><div><label><SearchRounded /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="မှတ်တမ်းရှာရန်…" /></label><button className={showFilters ? 'active' : ''} onClick={() => setShowFilters(value => !value)}><FilterListRounded />Filters</button><select value={`${sort.sortBy}:${sort.sortDirection}`} onChange={event => { const [sortBy, sortDirection] = event.target.value.split(':'); setSort({ sortBy, sortDirection }) }}><option value="updatedAt:desc">Recently updated</option><option value="createdAt:desc">Newest</option><option value="title:asc">Title A–Z</option></select></div></div>
        {showFilters && <div className="data-filter-panel">{collection.fields.map(field => <DynamicField key={field.id} field={{ ...field, required: false, options: filterOptions[field.key] || field.options }} value={filters[field.key] ?? ''} onChange={value => setFilters(current => { const next = { ...current }; if (value === '' || value === null) delete next[field.key]; else next[field.key] = value; return next })} />)}<button onClick={() => setFilters({})}>Clear filters</button></div>}
        <div className="data-record-table"><table><thead><tr><th>Name</th>{collection.fields.map(field => <th key={field.id}>{field.label}</th>)}<th>Last Updated</th><th>Actions</th></tr></thead><tbody>{records.items.map(record => <tr key={record.id} onDoubleClick={() => setDialog({ type: 'details', record })}><td><b>{record.title}</b></td>{collection.fields.map(field => <td key={field.id}>{field.type === 'BOOLEAN' ? (record.payload[field.key] ? 'Yes' : 'No') : field.type === 'DATE' ? formatDate(record.payload[field.key]) : String(record.payload[field.key] ?? '—')}</td>)}<td>{formatDate(record.updatedAt)}</td><td><button onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ kind: 'record', item: record, position: { right: window.innerWidth - rect.right, top: rect.bottom + 4 } }) }}><MoreVertRounded /></button></td></tr>)}</tbody></table>{records.loading && <div className="data-loading">Loading…</div>}{records.error && <div className="data-error">{records.error}</div>}{!records.loading && !records.items.length && <div className="data-empty"><StorageRounded /><b>မှတ်တမ်းမရှိသေးပါ</b><span>Add New ဖြင့် ပထမဆုံးမှတ်တမ်းထည့်နိုင်ပါသည်။</span></div>}<div ref={sentinel} className="data-sentinel">{records.nextCursor ? 'More records loading…' : records.items.length ? 'All records loaded' : ''}</div></div>
      </section>}
    </main>
    {menu?.kind === 'record' && <RecordMenu position={menu.position} onClose={() => setMenu(null)} onView={() => { setDialog({ type: 'details', record: menu.item }); setMenu(null) }} onEdit={() => { setDialog({ type: 'record', record: menu.item }); setMenu(null) }} onDelete={() => archiveRecord(menu.item)} />}
    {menu?.kind === 'collection' && <div className="data-row-menu" style={menu.position}><button onClick={() => { openCollection(menu.item); setMenu(null) }}><VisibilityOutlined />Open</button><button onClick={() => { setDialog({ type: 'collection-details', collection: menu.item }); setMenu(null) }}><InfoOutlined />Details</button></div>}
    {dialog?.type === 'record' && <RecordDialog tree={tree} initialCategory={selectedFolder} initialCollection={collection} record={dialog.record} onClose={closeDialog} onSaved={refreshRecords} refreshTree={treeQuery.refetch} />}
    {dialog?.type === 'dashboard' && <DashboardDialog collection={collection} onClose={closeDialog} />}
    {dialog?.type === 'details' && <Modal title={dialog.record.title} eyebrow="Record Details" onClose={closeDialog} actions={<button className="primary" onClick={closeDialog}>Done</button>}><dl className="data-details">{collection.fields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{String(dialog.record.payload[field.key] ?? '—')}</dd></div>)}<div><dt>Created</dt><dd>{formatDate(dialog.record.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(dialog.record.updatedAt)}</dd></div><div><dt>Source</dt><dd>{dialog.record.sourceType === 'EXCEL' ? 'Excel' : 'Manual'}</dd></div><div><dt>View</dt><dd>{dialog.record.accessLevel === 'VIP' ? 'VIP' : 'Normal'}</dd></div></dl></Modal>}
    {dialog?.type === 'collection-details' && <Modal title={dialog.collection.name} eyebrow="Structured Data" onClose={closeDialog} actions={<button className="primary" onClick={closeDialog}>Done</button>}><dl className="data-details"><div><dt>Location</dt><dd>{breadcrumb.map(item => item.name).join(' / ')}</dd></div><div><dt>Records</dt><dd>{dialog.collection._count?.records || 0}</dd></div><div><dt>Fields</dt><dd>{dialog.collection.fields.map(field => field.label).join(', ')}</dd></div><div><dt>Last Updated</dt><dd>{formatDate(dialog.collection.updatedAt)}</dd></div></dl></Modal>}
    {notice && <div className="data-toast">{notice}</div>}
  </section>
}

function useDocuments(categoryId, revision) {
  const [state, setState] = useState({ loading: true, error: '', items: [], category: null })
  useEffect(() => { let active = true; Promise.all([api(`/documents${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}&includeDescendants=true` : ''}`), categoryId ? api(`/categories/${categoryId}`) : Promise.resolve(null)]).then(([items, details]) => active && setState({ loading: false, error: '', items, category: details?.category || null })).catch(error => active && setState(current => ({ ...current, loading: false, error: error.message }))); return () => { active = false } }, [categoryId, revision])
  return state
}

export function DocumentsPage({ categoryId }) {
  const [revision, setRevision] = useState(0)
  const state = useDocuments(categoryId, revision)
  return <section className="filtered-page"><div className="filtered-heading"><div><h1>စာရွက်စာတမ်းများ</h1><p>{state.category ? `${state.category.name} နှင့် အောက်ခံအမျိုးအစားများရှိ ဖိုင်များ` : 'အမျိုးအစားအားလုံးရှိ စာရွက်စာတမ်းများ'}</p></div>{state.category && <span>▰ {state.category.name}</span>}</div><div className="filtered-toolbar"><b>{state.items.length.toLocaleString()} ဖိုင်</b></div><div className="filtered-card">{state.loading ? <div className="filtered-state">အချက်အလက်များ ဖွင့်နေသည်…</div> : state.error ? <div className="filtered-state error"><b>အချက်အလက် မဖွင့်နိုင်ပါ</b><span>{state.error}</span><button onClick={() => setRevision(value => value + 1)}>ပြန်စမ်းရန်</button></div> : !state.items.length ? <div className="filtered-state"><b>မှတ်တမ်းမရှိသေးပါ</b></div> : <div className="document-grid">{state.items.map(document => <article key={document.id}><span>{document.mimeType.includes('pdf') ? 'PDF' : 'JPG'}</span><div><h3>{document.title}</h3><p>{document.fileName}</p><small>{formatDate(document.updatedAt)}</small></div></article>)}</div>}</div></section>
}

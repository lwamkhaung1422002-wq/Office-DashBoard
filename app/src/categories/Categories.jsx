import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import AddRounded from '@mui/icons-material/AddRounded'
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DescriptionRounded from '@mui/icons-material/DescriptionRounded'
import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import RestoreRounded from '@mui/icons-material/RestoreRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import StorageRounded from '@mui/icons-material/StorageRounded'
import { flattenCategories } from './category-utils.js'
import { useCategoryDetails, useCategoryMutation, useCategoryTree } from './category-queries.js'
import './categories.css'

const dialogTitles = {
  root: 'ပင်မအမျိုးအစားအသစ် ထည့်ရန်',
  child: 'အောက်ခံအမျိုးအစားအသစ် ထည့်ရန်',
  edit: 'အမျိုးအစားအချက်အလက် ပြင်ဆင်ရန်',
  move: 'အမျိုးအစားနေရာ ရွှေ့ရန်',
  archive: 'အမျိုးအစား Archive ပြုလုပ်ရန်',
  restore: 'အမျိုးအစား ပြန်လည်အသုံးပြုရန်',
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('my-MM', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function CategoryTree({ nodes, selectedId, expanded, onToggle, onSelect, depth = 0 }) {
  return nodes.map(node => {
    const hasChildren = Boolean(node.children?.length)
    const isOpen = expanded.has(node.id)
    return <div className="category-tree-branch" key={node.id}>
      <div className={`category-tree-row ${selectedId === node.id ? 'selected' : ''} ${node.archivedAt ? 'archived' : ''}`} style={/** @type {import('react').CSSProperties} */ ({ '--depth': depth })}>
        <button className="tree-toggle" type="button" onClick={() => hasChildren && onToggle(node.id)} aria-label={hasChildren ? (isOpen ? 'အမျိုးအစားခေါက်ရန်' : 'အမျိုးအစားဖြန့်ရန်') : undefined} disabled={!hasChildren}>
          {hasChildren && (isOpen ? <ExpandMoreRounded /> : <ChevronRightRounded />)}
        </button>
        <button className="tree-select" type="button" onClick={() => onSelect(node.id)} aria-current={selectedId === node.id ? 'page' : undefined}>
          {isOpen && hasChildren ? <FolderOpenRounded /> : <FolderRounded />}
          <b>{node.name}</b>
        </button>
        <span className="tree-count" title="ဒေတာနှင့် စာရွက်စာတမ်း စုစုပေါင်း">{node.dataCount + node.documentCount}</span>
      </div>
      {hasChildren && isOpen && <CategoryTree nodes={node.children} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} depth={depth + 1} />}
    </div>
  })
}

function CategoryDialog({ mode, category, tree, onClose }) {
  const mutation = useCategoryMutation()
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [destination, setDestination] = useState('')
  const unavailable = useMemo(() => {
    if (!category) return new Set()
    const blocked = new Set([category.id])
    const visit = nodes => nodes.forEach(node => {
      if (blocked.has(node.id)) flattenCategories(node.children || []).forEach(child => blocked.add(child.id))
      else visit(node.children || [])
    })
    visit(tree)
    return blocked
  }, [category, tree])
  const destinations = useMemo(() => flattenCategories(tree).filter(item => !item.archivedAt && !unavailable.has(item.id)), [tree, unavailable])

  useEffect(() => {
    const closeOnEscape = event => event.key === 'Escape' && !mutation.isPending && onClose()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mutation.isPending, onClose])

  async function submit(event) {
    event.preventDefault()
    let values
    if (mode === 'root') values = { name: name.trim(), description: description.trim() || null }
    if (mode === 'child') values = { name: name.trim(), description: description.trim() || null, parentId: category.id }
    if (mode === 'edit') values = { name: name.trim(), description: description.trim() || null }
    if (mode === 'move') values = { parentId: destination || null }
    try {
      await mutation.mutateAsync({ mode, category, values })
      onClose()
    } catch {
      // The mutation error remains visible in the dialog for correction or retry.
    }
  }

  const error = mutation.error
  const blockedCounts = /** @type {any} */ (error)?.details
  const isForm = ['root', 'child', 'edit'].includes(mode)
  return <div className="modal-backdrop category-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !mutation.isPending && onClose()}>
    <form className="category-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="category-dialog-title">
      <header className="category-dialog-head">
        <div><small>အမျိုးအစားစီမံခန့်ခွဲမှု</small><h3 id="category-dialog-title">{dialogTitles[mode]}</h3></div>
        <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="ပိတ်ရန်"><CloseRounded /></button>
      </header>
      <div className="category-dialog-body">
        {isForm && <>
          {mode === 'child' && <p className="category-parent-note"><FolderRounded /> <span><small>ထည့်သွင်းမည့်နေရာ</small><b>{category.name}</b></span></p>}
          <label>အမျိုးအစားအမည် <em>*</em><input value={name} onChange={event => setName(event.target.value)} maxLength={120} required autoFocus /></label>
          <label>ဖော်ပြချက်<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={4} placeholder="အမျိုးအစားနှင့် သက်ဆိုင်သော အကျဉ်းချုပ်ရေးပါ" /></label>
        </>}
        {mode === 'move' && <>
          <p className="category-parent-note"><DriveFileMoveOutlined /><span><small>ရွှေ့မည့်အမျိုးအစား</small><b>{category.name}</b></span></p>
          <label>နေရာအသစ်<select value={destination} onChange={event => setDestination(event.target.value)} autoFocus><option value="">ပင်မအမျိုးအစားအဖြစ် ရွှေ့ရန်</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.path}</option>)}</select></label>
        </>}
        {(mode === 'archive' || mode === 'restore') && <div className={`category-confirm ${mode}`}>
          {mode === 'archive' ? <ArchiveOutlined /> : <RestoreRounded />}
          <div><b>{category.name}</b><p>{mode === 'archive' ? 'ဤအမျိုးအစားကို Archive ပြုလုပ်မည်မှာ သေချာပါသလား။ အောက်ခံအမျိုးအစား၊ ဒေတာ သို့မဟုတ် စာရွက်စာတမ်းရှိပါက မလုပ်ဆောင်နိုင်ပါ။' : 'ဤအမျိုးအစားကို ပြန်လည်အသုံးပြုနိုင်အောင် ပြုလုပ်မည်မှာ သေချာပါသလား။'}</p></div>
        </div>}
        {error && <div className="category-error" role="alert">
          <b>{error.message}</b>
          {blockedCounts && <span>အောက်ခံအမျိုးအစား {blockedCounts.children || 0} ခု၊ ဒေတာ {blockedCounts.dataRecords || 0} ခု၊ စာရွက်စာတမ်း {blockedCounts.documents || 0} ခု ရှိနေပါသည်။</span>}
        </div>}
      </div>
      <footer className="category-dialog-actions">
        <button type="button" onClick={onClose} disabled={mutation.isPending}>မလုပ်တော့ပါ</button>
        <button className={mode === 'archive' ? 'danger' : 'primary'} disabled={mutation.isPending || (isForm && !name.trim())}>{mutation.isPending ? 'လုပ်ဆောင်နေသည်…' : mode === 'archive' ? 'Archive ပြုလုပ်ရန်' : 'အတည်ပြုရန်'}</button>
      </footer>
    </form>
  </div>
}

function ChildActions({ child, onAction }) {
  return <details className="category-row-menu">
    <summary aria-label={`${child.name} လုပ်ဆောင်ချက်များ`}><MoreVertRounded /></summary>
    <div>
      <button type="button" onClick={() => onAction('edit', child)}><EditOutlined /> ပြင်ဆင်ရန်</button>
      <button type="button" onClick={() => onAction('move', child)}><DriveFileMoveOutlined /> ရွှေ့ရန်</button>
      {child.archivedAt
        ? <button type="button" onClick={() => onAction('restore', child)}><RestoreRounded /> ပြန်ဖွင့်ရန်</button>
        : <button type="button" className="danger" onClick={() => onAction('archive', child)}><ArchiveOutlined /> Archive</button>}
    </div>
  </details>
}

export default function Categories({ onViewData, onViewDocuments }) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [includeArchived, setIncludeArchived] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [dialog, setDialog] = useState(null)
  const treeQuery = useCategoryTree({ search: deferredSearch, includeArchived })
  const fullTreeQuery = useCategoryTree({ enabled: dialog?.mode === 'move' })
  const tree = useMemo(() => treeQuery.data || [], [treeQuery.data])
  const flatTree = useMemo(() => flattenCategories(tree), [tree])
  const effectiveSelectedId = flatTree.some(item => item.id === selectedId) ? selectedId : flatTree[0]?.id || null
  const displayedExpanded = useMemo(() => {
    if (deferredSearch) return new Set(flatTree.map(item => item.id))
    return expanded.size ? expanded : new Set(tree.map(item => item.id))
  }, [deferredSearch, expanded, flatTree, tree])
  const detailsQuery = useCategoryDetails(effectiveSelectedId)
  const details = detailsQuery.data
  const selected = details?.category
  const user = JSON.parse(sessionStorage.getItem('office_user') || '{}')
  const canManage = user.role === 'ADMIN'

  const toggleExpanded = id => setExpanded(() => {
    const next = new Set(displayedExpanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const openDialog = (mode, category = selected) => setDialog({ mode, category })
  const parent = details?.breadcrumb?.at(-2)
  const pageError = treeQuery.error || detailsQuery.error

  return <section className="categories-page">
    <header className="categories-heading">
      <div className="categories-title"><span><FolderRounded /></span><div><h1>အမျိုးအစားများ</h1><p>ဒေတာနှင့် စာရွက်စာတမ်းများကို ဖိုင်တွဲပုံစံဖြင့် စနစ်တကျ စီမံခန့်ခွဲပါ။</p></div></div>
      {canManage && <button className="category-primary-action" type="button" onClick={() => openDialog('root', null)}><AddRounded /> အမျိုးအစားအသစ်</button>}
    </header>

    <div className="categories-grid">
      <aside className="categories-tree-panel" aria-label="အမျိုးအစားအစီအစဉ်">
        <div className="category-search"><SearchRounded /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="အမျိုးအစား ရှာရန်…" aria-label="အမျိုးအစားရှာရန်" /></div>
        <label className="archived-toggle"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} /><span>Archive ပြုလုပ်ထားသည်များ ပြရန်</span></label>
        <div className="category-tree-scroll">
          {treeQuery.isLoading
            ? <div className="category-tree-skeleton" aria-label="အမျိုးအစားများ ဖွင့်နေသည်"><i /><i /><i /><i /></div>
            : tree.length
              ? <CategoryTree nodes={tree} selectedId={effectiveSelectedId} expanded={displayedExpanded} onToggle={toggleExpanded} onSelect={setSelectedId} />
              : <div className="category-state"><FolderRounded /><b>{deferredSearch ? 'ကိုက်ညီသော အမျိုးအစားမရှိပါ' : 'အမျိုးအစား မရှိသေးပါ'}</b><span>{deferredSearch ? 'အခြားစကားလုံးဖြင့် ပြန်လည်ရှာဖွေပါ။' : 'အမျိုးအစားအသစ်တစ်ခု စတင်ထည့်သွင်းနိုင်ပါသည်။'}</span></div>}
        </div>
      </aside>

      <main className="category-workspace">
        {pageError
          ? <div className="category-error-state" role="alert"><b>အမျိုးအစားအချက်အလက် မဖွင့်နိုင်ပါ</b><span>{pageError.message}</span><button type="button" onClick={() => { treeQuery.refetch(); detailsQuery.refetch() }}>ပြန်လည်ကြိုးစားရန်</button></div>
          : !selected || detailsQuery.isLoading
            ? <div className="category-detail-skeleton" aria-label="အသေးစိတ် ဖွင့်နေသည်"><i /><i /><i /><i /></div>
            : <>
              <nav className="category-breadcrumb" aria-label="အမျိုးအစားလမ်းကြောင်း">
                <button type="button" onClick={() => details.breadcrumb[0] && setSelectedId(details.breadcrumb[0].id)} aria-label="ပင်မအမျိုးအစား"><HomeRounded /></button>
                {details.breadcrumb.map(item => <span key={item.id}><ChevronRightRounded /><button type="button" onClick={() => setSelectedId(item.id)} aria-current={item.id === selected.id ? 'page' : undefined}>{item.name}</button></span>)}
              </nav>

              <section className="category-overview">
                <div className="category-overview-main">
                  <div className="category-summary-line">
                    <span className="category-summary-icon"><FolderRounded /></span>
                    <div className="category-summary-copy"><div><h2>{selected.name}</h2>{selected.archivedAt && <span className="category-status archived">Archive</span>}</div><p>{selected.description || 'ဖော်ပြချက် မထည့်ရသေးပါ။'}</p></div>
                  </div>
                  {canManage && <div className="category-actions">
                    <button type="button" className="accent" onClick={() => openDialog('edit')}><EditOutlined /> အမည်ပြင်ရန်</button>
                    <button type="button" onClick={() => openDialog('move')}><DriveFileMoveOutlined /> ရွှေ့ရန်</button>
                    {selected.archivedAt
                      ? <button type="button" onClick={() => openDialog('restore')}><RestoreRounded /> ပြန်ဖွင့်ရန်</button>
                      : <button type="button" onClick={() => openDialog('archive')}><ArchiveOutlined /> Archive</button>}
                  </div>}

                  <div className="category-metrics">
                    <article><span className="blue"><FolderRounded /></span><div><small>အောက်ခံအမျိုးအစားများ</small><b>{details.children.length.toLocaleString()}</b></div></article>
                    <article><span className="green"><StorageRounded /></span><div><small>ဒေတာမှတ်တမ်းများ</small><b>{selected.dataCount.toLocaleString()}</b></div></article>
                    <article><span className="purple"><DescriptionRounded /></span><div><small>စာရွက်စာတမ်းများ</small><b>{selected.documentCount.toLocaleString()}</b></div></article>
                  </div>
                  <div className="category-view-actions">
                    <button type="button" className="primary" onClick={() => onViewData?.(selected.id)}><StorageRounded /> ဒေတာကြည့်ရန် <ChevronRightRounded /></button>
                    <button type="button" onClick={() => onViewDocuments?.(selected.id)}><DescriptionRounded /> စာရွက်စာတမ်းများကြည့်ရန် <ChevronRightRounded /></button>
                  </div>
                </div>
                <dl className="category-metadata">
                  <div><dt>မူလအမျိုးအစား</dt><dd>{parent?.name || 'ပင်မအမျိုးအစား'}</dd></div>
                  <div><dt>အခြေအနေ</dt><dd><span className={`category-status ${selected.archivedAt ? 'archived' : 'active'}`}>{selected.archivedAt ? 'Archive' : 'အသုံးပြုနေ'}</span></dd></div>
                  <div><dt>ဖန်တီးခဲ့သည့်ရက်</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                  <div><dt>နောက်ဆုံးပြင်ဆင်ချိန်</dt><dd>{formatDate(selected.updatedAt)}</dd></div>
                </dl>
              </section>

              <section className="category-children">
                <header className="category-section-head">
                  <div><h3><FolderRounded /> အောက်ခံအမျိုးအစားများ <span>({details.children.length})</span></h3><p>{selected.name} အောက်ရှိ တိုက်ရိုက်အမျိုးအစားများ</p></div>
                  {canManage && !selected.archivedAt && <button type="button" onClick={() => openDialog('child')}><AddRounded /> အောက်ခံအသစ်</button>}
                </header>
                {details.children.length
                  ? <div className="category-table-wrap"><table className="category-children-table"><thead><tr><th>#</th><th>အမည်</th><th>ဖော်ပြချက်</th><th>ဒေတာ</th><th>စာရွက်စာတမ်း</th><th>အခြေအနေ</th><th><span className="visually-hidden">လုပ်ဆောင်ချက်</span></th></tr></thead><tbody>{details.children.map((child, index) => <tr key={child.id}><td>{index + 1}</td><td><button type="button" className="category-name-cell" onClick={() => setSelectedId(child.id)}><FolderRounded /> <b>{child.name}</b></button></td><td title={child.description || ''}>{child.description || '—'}</td><td>{child.dataCount.toLocaleString()}</td><td>{child.documentCount.toLocaleString()}</td><td><span className={`category-status ${child.archivedAt ? 'archived' : 'active'}`}>{child.archivedAt ? 'Archive' : 'အသုံးပြုနေ'}</span></td><td>{canManage ? <ChildActions child={child} onAction={openDialog} /> : <button className="row-open" type="button" onClick={() => setSelectedId(child.id)} aria-label={`${child.name} ဖွင့်ရန်`}><ChevronRightRounded /></button>}</td></tr>)}</tbody></table><p className="category-table-count">စုစုပေါင်း {details.children.length} ခု ပြထားသည်။</p></div>
                  : <div className="category-no-children"><FolderRounded /><b>အောက်ခံအမျိုးအစား မရှိသေးပါ</b><span>{canManage && !selected.archivedAt ? 'အောက်ခံအမျိုးအစားအသစ်တစ်ခု ထည့်သွင်းနိုင်ပါသည်။' : 'ဤအမျိုးအစားအောက်တွင် ဖိုင်တွဲမရှိသေးပါ။'}</span></div>}
              </section>
            </>}
      </main>
    </div>

    {dialog && <CategoryDialog mode={dialog.mode} category={dialog.category} tree={dialog.mode === 'move' ? (fullTreeQuery.data || tree) : tree} onClose={() => setDialog(null)} />}
  </section>
}

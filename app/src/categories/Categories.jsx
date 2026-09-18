import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { flattenCategories } from './category-utils.js'
import './categories.css'

const emptyForm = { name: '', description: '', parentId: null, sortOrder: 0 }

function CategoryTree({ nodes, selectedId, expanded, onToggle, onSelect, depth = 0 }) {
  return nodes.map(node => {
    const hasChildren = node.children?.length > 0
    const isOpen = expanded.has(node.id)
    return <div className="category-tree-branch" key={node.id}>
      <div className={`category-tree-row ${selectedId === node.id ? 'selected' : ''} ${node.archivedAt ? 'archived' : ''}`} style={{ '--depth': depth }}>
        <button className="tree-toggle" onClick={() => hasChildren && onToggle(node.id)} aria-label={isOpen ? 'ခေါက်ရန်' : 'ဖြန့်ရန်'}>{hasChildren ? (isOpen ? '⌄' : '›') : ''}</button>
        <button className="tree-select" onClick={() => onSelect(node.id)}><span className="tree-folder">▰</span><b>{node.name}</b></button>
        <span className="tree-count">{node.dataCount + node.documentCount}</span>
      </div>
      {hasChildren && isOpen && <CategoryTree nodes={node.children} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} depth={depth + 1} />}
    </div>
  })
}

function ActionDialog({ mode, selected, categories, onClose, onSaved }) {
  const [form, setForm] = useState(() => mode === 'edit' ? { name: selected.name, description: selected.description || '', sortOrder: selected.sortOrder } : { ...emptyForm, parentId: mode === 'child' ? selected.id : null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const title = { root: 'ပင်မအမျိုးအစားအသစ်', child: 'အောက်ခံအမျိုးအစားအသစ်', edit: 'အမျိုးအစားပြင်ဆင်ရန်', move: 'အမျိုးအစားရွှေ့ရန်', archive: 'Archive ပြုလုပ်ရန်', restore: 'ပြန်လည်အသုံးပြုရန်' }[mode]
  const unavailable = new Set([selected?.id])
  const markDescendants = node => { if (unavailable.has(node.id)) (node.children || []).forEach(child => { unavailable.add(child.id); markDescendants(child) }); else (node.children || []).forEach(markDescendants) }
  categories.forEach(markDescendants)
  const destinations = flattenCategories(categories).filter(node => !unavailable.has(node.id) && !node.archivedAt)

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      if (mode === 'root' || mode === 'child') await api('/categories', { method: 'POST', body: JSON.stringify(form) })
      if (mode === 'edit') await api(`/categories/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ name: form.name, description: form.description || null, sortOrder: Number(form.sortOrder) }) })
      if (mode === 'move') await api(`/categories/${selected.id}/move`, { method: 'POST', body: JSON.stringify({ parentId: form.parentId || null }) })
      if (mode === 'archive') await api(`/categories/${selected.id}/archive`, { method: 'POST' })
      if (mode === 'restore') await api(`/categories/${selected.id}/restore`, { method: 'POST' })
      await onSaved()
      onClose()
    } catch (requestError) {
      const counts = requestError.details
      setError(counts ? `${requestError.message} (${counts.children || 0} children, ${counts.dataRecords || 0} data, ${counts.documents || 0} documents)` : requestError.message)
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="category-dialog" onSubmit={submit}>
      <div className="category-dialog-head"><div><small>အမျိုးအစားစီမံခန့်ခွဲမှု</small><h3>{title}</h3></div><button type="button" onClick={onClose} aria-label="ပိတ်ရန်">×</button></div>
      {(mode === 'root' || mode === 'child' || mode === 'edit') && <>
        <label>အမျိုးအစားအမည် *<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength="120" required autoFocus /></label>
        <label>ဖော်ပြချက်<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength="1000" rows="4" /></label>
        <label>အစီအစဉ်<input type="number" min="0" max="100000" value={form.sortOrder} onChange={event => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
      </>}
      {mode === 'move' && <label>ရွှေ့မည့်နေရာ<select value={form.parentId || ''} onChange={event => setForm({ ...form, parentId: event.target.value || null })}><option value="">ပင်မအဆင့်</option>{destinations.map(node => <option value={node.id} key={node.id}>{node.path}</option>)}</select></label>}
      {(mode === 'archive' || mode === 'restore') && <div className={`category-confirm ${mode}`}><span>{mode === 'archive' ? '▣' : '↻'}</span><p><b>{selected.name}</b> ကို {mode === 'archive' ? 'Archive ပြုလုပ်' : 'ပြန်လည်အသုံးပြု'}မည်မှာ သေချာပါသလား။</p></div>}
      {error && <div className="category-error" role="alert">{error}</div>}
      <div className="category-dialog-actions"><button type="button" onClick={onClose}>မလုပ်တော့ပါ</button><button className={mode === 'archive' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'လုပ်ဆောင်နေသည်…' : 'အတည်ပြုရန်'}</button></div>
    </form>
  </div>
}

export default function Categories({ onViewData, onViewDocuments }) {
  const [tree, setTree] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [details, setDetails] = useState(null)
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [expanded, setExpanded] = useState(new Set())
  const [dialog, setDialog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTree = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const nodes = await api(`/categories?search=${encodeURIComponent(search)}&includeArchived=${includeArchived}`)
      setTree(nodes)
      const all = flattenCategories(nodes)
      const nextId = all.some(node => node.id === selectedId) ? selectedId : all[0]?.id || null
      setSelectedId(nextId)
      setExpanded(current => search ? new Set(all.map(node => node.id)) : (current.size ? current : new Set(nodes.map(node => node.id))))
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }, [includeArchived, search, selectedId])

  useEffect(() => { const timer = setTimeout(loadTree, 250); return () => clearTimeout(timer) }, [loadTree])
  useEffect(() => {
    if (selectedId) api(`/categories/${selectedId}`).then(setDetails).catch(requestError => setError(requestError.message))
  }, [selectedId])

  const selected = details?.category
  const refresh = async () => { await loadTree(); if (selectedId) setDetails(await api(`/categories/${selectedId}`)) }
  const canManage = ['ADMIN', 'CATEGORY_ADMIN'].includes(JSON.parse(sessionStorage.getItem('office_user') || '{}').role)

  return <section className="categories-page">
    <div className="categories-heading"><div><h1>အမျိုးအစားများ</h1><p>ဒေတာနှင့် စာရွက်စာတမ်းများကို အဆင့်ဆင့် စနစ်တကျ စီမံပါ။</p></div>{canManage && <button className="primary" onClick={() => setDialog('root')}>＋ ပင်မအမျိုးအစားအသစ်</button>}</div>
    <div className="categories-grid">
      <aside className="categories-tree-panel">
        <div className="category-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="အမျိုးအစား ရှာဖွေရန်…" /></div>
        <label className="archived-toggle"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} /> Archive များပြရန်</label>
        <div className="category-tree-scroll">{loading ? <div className="category-state">ဖွင့်နေသည်…</div> : tree.length ? <CategoryTree nodes={tree} selectedId={selectedId} expanded={expanded} onToggle={id => setExpanded(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })} onSelect={setSelectedId} /> : <div className="category-state">အမျိုးအစား မရှိသေးပါ</div>}</div>
      </aside>
      <main className="category-workspace">
        {error ? <div className="category-error-state"><b>အချက်အလက် မဖွင့်နိုင်ပါ</b><span>{error}</span><button onClick={loadTree}>ပြန်စမ်းရန်</button></div> : !selected ? <div className="category-empty"><span>▰</span><h2>အမျိုးအစားတစ်ခု ရွေးချယ်ပါ</h2><p>ဘယ်ဘက်အပင်မှ အမျိုးအစားကို ရွေးချယ်ပြီး အသေးစိတ်ကြည့်ရှုနိုင်ပါသည်။</p></div> : <>
          <div className="category-breadcrumb"><button onClick={() => setSelectedId(details.breadcrumb[0]?.id)}>⌂</button>{details.breadcrumb.map((item, index) => <span key={item.id}>{index > 0 && <i>›</i>}<button onClick={() => setSelectedId(item.id)}>{item.name}</button></span>)}</div>
          <header className="category-summary"><div className="category-summary-icon">▰</div><div className="category-summary-copy"><div><h2>{selected.name}</h2>{selected.archivedAt && <span>Archive</span>}</div><p>{selected.description || 'ဖော်ပြချက် မထည့်ရသေးပါ'}</p><small>နောက်ဆုံးပြင်ဆင်မှု · {new Date(selected.updatedAt).toLocaleDateString('my-MM')}</small></div>{canManage && <div className="category-actions"><button onClick={() => setDialog('edit')}>✎ ပြင်ဆင်</button><button onClick={() => setDialog('move')}>↗ ရွှေ့ရန်</button>{selected.archivedAt ? <button onClick={() => setDialog('restore')}>↻ ပြန်ဖွင့်ရန်</button> : <button className="danger" onClick={() => setDialog('archive')}>▣ Archive</button>}</div>}</header>
          <div className="category-metrics"><article><span className="blue">▦</span><div><small>ဒေတာများ</small><b>{selected.dataCount.toLocaleString()}</b><em>အောက်ခံများအပါအဝင်</em></div><button onClick={() => onViewData?.(selected.id)}>ကြည့်ရန် →</button></article><article><span className="purple">▣</span><div><small>စာရွက်စာတမ်းများ</small><b>{selected.documentCount.toLocaleString()}</b><em>အောက်ခံများအပါအဝင်</em></div><button onClick={() => onViewDocuments?.(selected.id)}>ကြည့်ရန် →</button></article><article><span className="green">⌘</span><div><small>တိုက်ရိုက်အောက်ခံများ</small><b>{details.children.length}</b><em>အမျိုးအစား</em></div></article></div>
          <section className="category-children"><div className="category-section-head"><div><h3>တိုက်ရိုက်အောက်ခံအမျိုးအစားများ</h3><p>{selected.name} အောက်တွင် တိုက်ရိုက်ရှိသော အမျိုးအစားများ</p></div>{canManage && !selected.archivedAt && <button onClick={() => setDialog('child')}>＋ အောက်ခံအသစ်</button>}</div>{details.children.length ? <div className="category-child-grid">{details.children.map(child => <button key={child.id} onClick={() => setSelectedId(child.id)}><span>▰</span><div><b>{child.name}</b><small>{child.dataCount} ဒေတာ · {child.documentCount} စာရွက်စာတမ်း</small></div><i>›</i></button>)}</div> : <div className="category-no-children">အောက်ခံအမျိုးအစား မရှိသေးပါ</div>}</section>
        </>}
      </main>
    </div>
    {dialog && selectedId !== undefined && <ActionDialog mode={dialog} selected={selected} categories={tree} onClose={() => setDialog(null)} onSaved={refresh} />}
  </section>
}

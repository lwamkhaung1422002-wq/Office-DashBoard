import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import './filtered-modules.css'

function useCategoryResource(resource, categoryId, revision, dataCollectionId = null) {
  const [state, setState] = useState({ loading: true, error: '', items: [], category: null })
  useEffect(() => {
    let active = true
    Promise.all([
      api(`/${resource}${categoryId || dataCollectionId ? `?${new URLSearchParams({ ...(categoryId ? { categoryId, includeDescendants: dataCollectionId ? 'false' : 'true' } : {}), ...(dataCollectionId ? { dataCollectionId } : {}) })}` : ''}`),
      categoryId ? api(`/categories/${categoryId}`) : Promise.resolve(null),
    ]).then(([items, details]) => active && setState({ loading: false, error: '', items, category: details?.category || null }))
      .catch(error => active && setState(current => ({ ...current, loading: false, error: error.message })))
    return () => { active = false }
  }, [categoryId, dataCollectionId, resource, revision])
  return state
}

function State({ loading, error, empty, retry }) {
  if (loading) return <div className="filtered-state">အချက်အလက်များ ဖွင့်နေသည်…</div>
  if (error) return <div className="filtered-state error"><b>အချက်အလက် မဖွင့်နိုင်ပါ</b><span>{error}</span><button onClick={retry}>ပြန်စမ်းရန်</button></div>
  if (empty) return <div className="filtered-state"><b>မှတ်တမ်းမရှိသေးပါ</b><span>ရွေးချယ်ထားသော အမျိုးအစားတွင် အချက်အလက် မရှိသေးပါ။</span></div>
  return null
}

export function DataRecordsPage({ categoryId, dataCollectionId = null }) {
  const [revision, setRevision] = useState(0)
  const state = useCategoryResource('data', categoryId, revision, dataCollectionId)
  const [search, setSearch] = useState('')
  const rows = useMemo(() => state.items.filter(item => `${item.title} ${JSON.stringify(item.payload)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [search, state.items])
  return <section className="filtered-page">
    <div className="filtered-heading"><div><h1>ဒေတာများ</h1><p>{state.category ? `${state.category.name} နှင့် အောက်ခံအမျိုးအစားများရှိ ဒေတာ` : 'အမျိုးအစားအားလုံးရှိ ဒေတာမှတ်တမ်းများ'}</p></div>{state.category && <span>▰ {state.category.name}</span>}</div>
    <div className="filtered-toolbar"><label>⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="ဒေတာရှာဖွေရန်…" /></label><b>{rows.length.toLocaleString()} မှတ်တမ်း</b></div>
    <div className="filtered-card"><State {...state} empty={!rows.length} retry={() => setRevision(value => value + 1)} />{!state.loading && !state.error && rows.length > 0 && <div className="filtered-table"><table><thead><tr><th>#</th><th>ခေါင်းစဉ်</th><th>အချက်အလက်</th><th>နောက်ဆုံးပြင်ဆင်မှု</th></tr></thead><tbody>{rows.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td><b>{record.title}</b></td><td><code>{JSON.stringify(record.payload)}</code></td><td>{new Date(record.updatedAt).toLocaleDateString('my-MM')}</td></tr>)}</tbody></table></div>}</div>
  </section>
}

export function DocumentsPage({ categoryId }) {
  const [revision, setRevision] = useState(0)
  const state = useCategoryResource('documents', categoryId, revision)
  return <section className="filtered-page">
    <div className="filtered-heading"><div><h1>စာရွက်စာတမ်းများ</h1><p>{state.category ? `${state.category.name} နှင့် အောက်ခံအမျိုးအစားများရှိ ဖိုင်များ` : 'အမျိုးအစားအားလုံးရှိ စာရွက်စာတမ်းများ'}</p></div>{state.category && <span>▰ {state.category.name}</span>}</div>
    <div className="filtered-toolbar"><b>{state.items.length.toLocaleString()} ဖိုင်</b></div>
    <div className="filtered-card"><State {...state} empty={!state.items.length} retry={() => setRevision(value => value + 1)} />{!state.loading && !state.error && state.items.length > 0 && <div className="document-grid">{state.items.map(document => <article key={document.id}><span>{document.mimeType.includes('pdf') ? 'PDF' : document.mimeType.includes('image') ? 'JPG' : 'FILE'}</span><div><h3>{document.title}</h3><p>{document.fileName}</p><small>{new Date(document.updatedAt).toLocaleDateString('my-MM')}</small></div></article>)}</div>}</div>
  </section>
}

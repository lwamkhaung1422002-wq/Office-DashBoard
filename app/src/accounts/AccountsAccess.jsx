import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import './accounts-access.css'

const roleLabels = {
  ADMIN: 'Administrator',
  VIP_VIEWER: 'VIP Viewer',
  NORMAL_VIEWER: 'Normal Viewer',
}

const emptyForm = { name: '', email: '', role: 'NORMAL_VIEWER' }

export default function AccountsAccess() {
  const [tab, setTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [linkResult, setLinkResult] = useState(null)
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [accountRows, accessRows] = await Promise.all([api('/admin/users'), api('/admin/users/access-levels')])
      setAccounts(accountRows)
      setLevels(accessRows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? accounts.filter(row => `${row.name} ${row.email} ${roleLabels[row.role]} ${row.status}`.toLowerCase().includes(needle)) : accounts
  }, [accounts, query])

  const perform = async action => {
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const addAccount = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api('/admin/users/invitations', { method: 'POST', body: JSON.stringify(form) })
      setLinkResult({ title: 'Account setup link', url: result.setupUrl })
      setForm(emptyForm)
      setShowAdd(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const regenerate = row => perform(async () => {
    const result = await api(`/admin/users/invitations/${row.id}/regenerate`, { method: 'POST' })
    setLinkResult({ title: 'New account setup link', url: result.setupUrl })
  })

  const resetLogin = row => perform(async () => {
    const result = await api(`/admin/users/${row.id}/reset-login`, { method: 'POST' })
    setLinkResult({ title: 'Secure login reset link', url: result.resetUrl })
  })

  return <section className="accounts-access">
    <div className="accounts-heading">
      <div><span>စနစ်စီမံခန့်ခွဲမှု</span><h1>အသုံးပြုသူနှင့် ဝင်ရောက်ခွင့်</h1><p>အကောင့်ဖိတ်ကြားမှု၊ အခန်းကဏ္ဍနှင့် ဝင်ရောက်ခွင့်အခြေအနေများကို စီမံပါ။</p></div>
      {tab === 'accounts' && <button className="accounts-primary" onClick={() => setShowAdd(true)}>＋ အကောင့်ထည့်ရန်</button>}
    </div>
    <div className="accounts-tabs" role="tablist">
      <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>အကောင့်များ</button>
      <button className={tab === 'levels' ? 'active' : ''} onClick={() => setTab('levels')}>ဝင်ရောက်ခွင့်အဆင့်များ</button>
    </div>
    {error && <div className="accounts-alert">{error}</div>}

    {tab === 'accounts' && <div className="accounts-panel">
      <div className="accounts-toolbar"><label>⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="အမည် သို့မဟုတ် အီးမေးလ် ရှာရန်..." /></label><span>စုစုပေါင်း {visible.length} အကောင့်</span></div>
      {loading ? <div className="accounts-state">အချက်အလက် ရယူနေသည်...</div> : <div className="accounts-table-wrap"><table>
        <thead><tr><th>အသုံးပြုသူ</th><th>အခန်းကဏ္ဍ</th><th>အခြေအနေ</th><th>နောက်ဆုံးဝင်ရောက်မှု</th><th>လုပ်ဆောင်ချက်</th></tr></thead>
        <tbody>{visible.map(row => <tr key={`${row.kind}-${row.id}`}>
          <td><div className="account-person"><span>{row.name?.slice(0, 1).toUpperCase()}</span><div><b>{row.name}{row.isPrimaryAdmin && <em>MAIN ADMIN</em>}</b><small>{row.email}</small></div></div></td>
          <td>{row.kind === 'USER' && !row.isPrimaryAdmin ? <select value={row.role} onChange={event => perform(() => api(`/admin/users/${row.id}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }))}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select> : <span className="role-pill">{roleLabels[row.role]}</span>}</td>
          <td><span className={`account-status ${row.status.toLowerCase()}`}>{row.status === 'SETUP_REQUIRED' ? 'Setup Required' : row.status === 'RESET_REQUIRED' ? 'Reset Required' : row.status === 'ACTIVE' ? 'Active' : row.status === 'DISABLED' ? 'Disabled' : 'Expired'}</span></td>
          <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : '—'}</td>
          <td><div className="account-actions">{row.kind === 'INVITATION' ? <><button onClick={() => regenerate(row)}>Link အသစ်</button><button className="danger" onClick={() => perform(() => api(`/admin/users/invitations/${row.id}/cancel`, { method: 'POST' }))}>ပယ်ဖျက်</button></> : row.isPrimaryAdmin ? <span className="protected-note">Protected</span> : <><button onClick={() => resetLogin(row)} disabled={!row.isActive}>Login Reset</button><button className={row.isActive ? 'danger' : ''} onClick={() => perform(() => api(`/admin/users/${row.id}/${row.isActive ? 'disable' : 'enable'}`, { method: 'POST' }))}>{row.isActive ? 'Disable' : 'Enable'}</button></>}</div></td>
        </tr>)}</tbody>
      </table>{!visible.length && <div className="accounts-state">အကောင့် မတွေ့ပါ။</div>}</div>}
    </div>}

    {tab === 'levels' && <div className="access-level-grid">{levels.map((level, index) => <article key={level.role}><span>{index === 0 ? '◆' : index === 1 ? '★' : '●'}</span><h3>{level.label}</h3><p>{level.description}</p><strong>Read-only policy</strong></article>)}</div>}

    {showAdd && <div className="account-modal" role="dialog" aria-modal="true"><form onSubmit={addAccount}><header><div><h2>အကောင့်အသစ် ဖိတ်ကြားရန်</h2><p>ယာယီ password မပေးဘဲ secure setup link တစ်ခုဖန်တီးပါမည်။</p></div><button type="button" onClick={() => setShowAdd(false)}>×</button></header><label>အမည်<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>အီးမေးလ်<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>အခန်းကဏ္ဍ<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><footer><button type="button" onClick={() => setShowAdd(false)}>မလုပ်တော့ပါ</button><button className="accounts-primary" disabled={saving}>{saving ? 'ဖန်တီးနေသည်...' : 'Setup link ဖန်တီးရန်'}</button></footer></form></div>}
    {linkResult && <div className="account-modal" role="dialog" aria-modal="true"><div className="link-result"><header><div><h2>{linkResult.title}</h2><p>ဤ link ကို သက်ဆိုင်ရာအသုံးပြုသူထံ လုံခြုံစွာမျှဝေပါ။ Link အသစ်ဖန်တီးလျှင် အဟောင်း ပျက်သွားပါမည်။</p></div><button onClick={() => setLinkResult(null)}>×</button></header><code>{linkResult.url}</code><footer><button onClick={() => setLinkResult(null)}>ပိတ်ရန်</button><button className="accounts-primary" onClick={() => navigator.clipboard.writeText(linkResult.url)}>Link ကူးယူရန်</button></footer></div></div>}
  </section>
}

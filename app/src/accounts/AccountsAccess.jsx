import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import './accounts-access.css'
import './accounts-access-enhancements.css'

export const accountAccessOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'VIP_VIEWER', label: 'VIP Viewer' },
  { value: 'NORMAL_VIEWER', label: 'Normal Viewer' },
]

const roleLabels = Object.fromEntries(accountAccessOptions.map(item => [item.value, item.label]))
const emptyForm = { name: '', email: '', role: 'NORMAL_VIEWER' }
const statusLabel = status => ({ ACTIVE: 'Active', DISABLED: 'Disabled', SETUP_REQUIRED: 'Setup Required', RESET_REQUIRED: 'Reset Required', EXPIRED: 'Expired' })[status] || status

export default function AccountsAccess() {
  const [tab, setTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [changeAccess, setChangeAccess] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [linkResult, setLinkResult] = useState(null)
  const [query, setQuery] = useState('')
  const [accessFilter, setAccessFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

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

  const summary = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter(row => row.status === 'ACTIVE').length,
    setup: accounts.filter(row => row.status === 'SETUP_REQUIRED').length,
    disabled: accounts.filter(row => row.status === 'DISABLED').length,
  }), [accounts])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return accounts.filter(row => {
      const matchesSearch = !needle || `${row.name} ${row.email} ${roleLabels[row.role]} ${row.status}`.toLowerCase().includes(needle)
      const matchesAccess = accessFilter === 'ALL' || row.role === accessFilter
      const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter
      return matchesSearch && matchesAccess && matchesStatus
    })
  }, [accessFilter, accounts, query, statusFilter])

  const perform = async action => {
    setError('')
    try {
      await action()
      await load()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  const addAccount = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api('/admin/users/invitations', { method: 'POST', body: JSON.stringify(form) })
      setLinkResult({ title: 'Account Invitation Created', url: result.setupUrl, name: form.name, email: form.email, access: roleLabels[form.role], kind: 'setup' })
      setForm(emptyForm)
      setShowAdd(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveAccess = async event => {
    event.preventDefault()
    setSaving(true)
    const saved = await perform(() => api(`/admin/users/${changeAccess.id}`, { method: 'PATCH', body: JSON.stringify({ role: changeAccess.nextRole }) }))
    setSaving(false)
    if (saved) setChangeAccess(null)
  }

  const regenerate = row => perform(async () => {
    const result = await api(`/admin/users/invitations/${row.id}/regenerate`, { method: 'POST' })
    setLinkResult({ title: 'New Account Setup Link', url: result.setupUrl, name: row.name, email: row.email, access: roleLabels[row.role], kind: 'setup' })
  })

  const resetLogin = row => perform(async () => {
    const result = await api(`/admin/users/${row.id}/reset-login`, { method: 'POST' })
    setLinkResult({ title: 'Reset Login Link Created', url: result.resetUrl, name: row.name, email: row.email, access: roleLabels[row.role], kind: 'reset' })
  })

  return <section className="accounts-access">
    <div className="accounts-heading">
      <div><span>စနစ်စီမံခန့်ခွဲမှု</span><h1>Accounts &amp; Access</h1><p>အကောင့်ဖိတ်ကြားမှု၊ access level နှင့် ဝင်ရောက်ခွင့်အခြေအနေများကို စီမံပါ။</p></div>
      {tab === 'accounts' && <button className="accounts-primary" onClick={() => setShowAdd(true)}>＋ Add Account</button>}
    </div>

    <div className="accounts-tabs" role="tablist">
      <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Accounts</button>
      <button className={tab === 'levels' ? 'active' : ''} onClick={() => setTab('levels')}>Access Levels</button>
    </div>
    {error && <div className="accounts-alert">{error}</div>}

    {tab === 'accounts' && <>
      <div className="account-summary-grid">
        <SummaryCard icon="◎" label="Total Accounts" value={summary.total} tone="blue" />
        <SummaryCard icon="✓" label="Active" value={summary.active} tone="green" />
        <SummaryCard icon="◷" label="Setup Required" value={summary.setup} tone="amber" />
        <SummaryCard icon="⊘" label="Disabled" value={summary.disabled} tone="slate" />
      </div>
      <div className="accounts-panel">
        <div className="accounts-toolbar account-filter-toolbar">
          <label className="account-search">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or email..." /></label>
          <div className="account-filters">
            <select aria-label="Filter by access" value={accessFilter} onChange={event => setAccessFilter(event.target.value)}><option value="ALL">All Access</option>{accountAccessOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="SETUP_REQUIRED">Setup Required</option><option value="DISABLED">Disabled</option><option value="RESET_REQUIRED">Reset Required</option></select>
          </div>
        </div>
        {loading ? <div className="accounts-state">အချက်အလက် ရယူနေသည်...</div> : <div className="accounts-table-wrap"><table>
          <thead><tr><th>No</th><th>Account</th><th>Access</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>{visible.map((row, index) => <tr key={`${row.kind}-${row.id}`}>
            <td className="account-number">{index + 1}</td>
            <td><div className="account-person"><span>{row.name?.slice(0, 1).toUpperCase()}</span><div><b>{row.name}</b><small>{row.email}</small></div></div></td>
            <td><span className={`access-chip ${row.isPrimaryAdmin ? 'primary-admin' : row.role.toLowerCase()}`}>{row.isPrimaryAdmin ? 'Main Admin' : roleLabels[row.role]}</span></td>
            <td><span className={`account-status ${row.status.toLowerCase()}`}>{statusLabel(row.status)}</span></td>
            <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : '—'}</td>
            <td><AccountActions row={row} onChangeAccess={() => setChangeAccess({ ...row, nextRole: row.role })} onReset={() => resetLogin(row)} onRegenerate={() => regenerate(row)} onAction={perform} /></td>
          </tr>)}</tbody>
        </table>{!visible.length && <div className="accounts-state">အကောင့် မတွေ့ပါ။</div>}</div>}
      </div>
    </>}

    {tab === 'levels' && <div className="access-level-grid">{levels.map((level, index) => <AccessLevelCard key={level.role} level={level} index={index} />)}</div>}

    {showAdd && <AccountDialog title="Add Account" description="Password မတောင်းဘဲ secure one-time setup link တစ်ခု ဖန်တီးပါမည်။" onClose={() => setShowAdd(false)} onSubmit={addAccount} saving={saving}>
      <label>Full Name *<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email Address *<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label>Access *<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{accountAccessOptions.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    </AccountDialog>}

    {changeAccess && <AccountDialog title="Change Access" description={`${changeAccess.name} အတွက် access level ကိုပြောင်းရန်`} onClose={() => setChangeAccess(null)} onSubmit={saveAccess} saving={saving} submitLabel="Save Changes">
      <div className="current-access"><span>Current</span><b>{roleLabels[changeAccess.role]}</b></div>
      <label>New Access<select value={changeAccess.nextRole} onChange={event => setChangeAccess({ ...changeAccess, nextRole: event.target.value })}>{accountAccessOptions.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    </AccountDialog>}

    {linkResult && <LinkResult result={linkResult} onClose={() => setLinkResult(null)} />}
  </section>
}

function SummaryCard({ icon, label, value, tone }) {
  return <article className={`account-summary ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function AccountActions({ row, onChangeAccess, onReset, onRegenerate, onAction }) {
  if (row.isPrimaryAdmin) return <span className="protected-note">Protected Main Admin</span>
  if (row.kind === 'INVITATION') return <div className="account-actions"><button onClick={onRegenerate}>Generate New Setup Link</button><button className="danger" onClick={() => onAction(() => api(`/admin/users/invitations/${row.id}/cancel`, { method: 'POST' }))}>Cancel Invitation</button></div>
  if (!row.isActive) return <div className="account-actions"><button onClick={() => onAction(() => api(`/admin/users/${row.id}/enable`, { method: 'POST' }))}>Enable</button></div>
  return <div className="account-actions"><button onClick={onChangeAccess}>Change Access</button><button onClick={onReset}>Reset Login</button><button className="danger" onClick={() => onAction(() => api(`/admin/users/${row.id}/disable`, { method: 'POST' }))}>Disable</button></div>
}

function AccountDialog({ title, description, onClose, onSubmit, saving, submitLabel = 'Create Setup Link', children }) {
  return <div className="account-modal" role="dialog" aria-modal="true"><form onSubmit={onSubmit}><header><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onClose}>×</button></header>{children}<footer><button type="button" onClick={onClose}>Cancel</button><button className="accounts-primary" disabled={saving}>{saving ? 'Saving...' : submitLabel}</button></footer></form></div>
}

function LinkResult({ result, onClose }) {
  const note = result.kind === 'reset'
    ? 'Current sessions have ended. This secure, expiring link may be used once to set a new password.'
    : 'This secure, expiring link is intended for one-time account setup. No email was sent automatically.'
  return <div className="account-modal" role="dialog" aria-modal="true"><div className="link-result"><header><div><h2>{result.title}</h2><p>{note}</p></div><button onClick={onClose}>×</button></header><dl><div><dt>Name</dt><dd>{result.name}</dd></div><div><dt>Email</dt><dd>{result.email}</dd></div><div><dt>Access</dt><dd>{result.access}</dd></div></dl><label>{result.kind === 'reset' ? 'Reset Link' : 'Setup Link'}<code>{result.url}</code></label><footer><button onClick={onClose}>Close</button><button className="accounts-primary" onClick={() => navigator.clipboard.writeText(result.url)}>Copy {result.kind === 'reset' ? 'Reset' : 'Setup'} Link</button></footer></div></div>
}

function AccessLevelCard({ level, index }) {
  const capabilities = level.role === 'ADMIN'
    ? ['File Manager', 'Data management', 'Dashboard administration', 'Accounts & Access', 'Audit Log', 'NORMAL content', 'VIP content']
    : level.role === 'VIP_VIEWER'
      ? ['Viewer Dashboard', 'NORMAL content', 'VIP content']
      : ['Viewer Dashboard', 'NORMAL content']
  const restrictions = level.role === 'ADMIN' ? [] : level.role === 'VIP_VIEWER' ? ['Admin management'] : ['VIP content', 'Admin management']
  return <article><span>{index === 0 ? '◆' : index === 1 ? '★' : '●'}</span><h3>{level.label}</h3><p>{level.description}</p><ul>{capabilities.map(item => <li className="allowed" key={item}>✓ {item}</li>)}{restrictions.map(item => <li className="denied" key={item}>× {item}</li>)}</ul><strong>Read-only access policy</strong></article>
}

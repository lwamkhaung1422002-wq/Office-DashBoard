import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { accountAccessOptions, accountActionItems } from './accounts-utils.js'
import { copyText } from './copy-text.js'
import './accounts-access.css'
import './accounts-access-enhancements.css'

const roleLabels = Object.fromEntries(accountAccessOptions.map(item => [item.value, item.label]))
const emptyForm = { name: '', email: '', role: 'NORMAL_VIEWER' }
const statusLabel = status => ({
  ACTIVE: 'Active',
  DISABLED: 'Deactivated',
  SETUP_REQUIRED: 'Setup Required',
  RESET_REQUIRED: 'Reset Required',
  EXPIRED: 'Expired',
})[status] || status

export default function AccountsAccess() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [changeAccess, setChangeAccess] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [linkResult, setLinkResult] = useState(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setAccounts(await api('/admin/users'))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial server data fetch synchronizes this page with the account store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const summary = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter(row => row.status === 'ACTIVE').length,
    setup: accounts.filter(row => row.status === 'SETUP_REQUIRED').length,
    deactivated: accounts.filter(row => row.status === 'DISABLED').length,
  }), [accounts])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return accounts.filter(row => {
      const matchesSearch = !needle || `${row.name} ${row.email}`.toLowerCase().includes(needle)
      const matchesRole = roleFilter === 'ALL' || row.role === roleFilter
      const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [accounts, query, roleFilter, statusFilter])

  const perform = async action => {
    setError('')
    try {
      const data = await action()
      await load()
      return { ok: true, data }
    } catch (requestError) {
      setError(requestError.message)
      return { ok: false, data: null }
    }
  }

  const addAccount = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api('/admin/users/invitations', { method: 'POST', body: JSON.stringify(form) })
      setLinkResult({ title: 'Account Created', url: result.setupUrl, name: form.name, email: form.email, role: roleLabels[form.role], kind: 'setup' })
      setForm(emptyForm)
      setShowAdd(false)
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const saveAccess = async event => {
    event.preventDefault()
    setSaving(true)
    const result = await perform(() => api(`/admin/users/${changeAccess.id}`, { method: 'PATCH', body: JSON.stringify({ role: changeAccess.nextRole }) }))
    setSaving(false)
    if (result.ok) setChangeAccess(null)
  }

  const resetLogin = async row => {
    const result = await perform(() => api(`/admin/users/${row.id}/reset-login`, { method: 'POST' }))
    if (result.ok) setLinkResult({ title: 'Login Reset Required', url: result.data.resetUrl, kind: 'reset' })
  }

  const deactivate = async () => {
    if (!deactivateTarget) return
    setSaving(true)
    const result = await perform(() => api(`/admin/users/${deactivateTarget.id}/disable`, { method: 'POST' }))
    setSaving(false)
    if (result.ok) setDeactivateTarget(null)
  }

  const reactivate = row => perform(() => api(`/admin/users/${row.id}/enable`, { method: 'POST' }))

  return <section className="accounts-access">
    <div className="accounts-top-actions"><button className="accounts-primary" onClick={() => setShowAdd(true)}>＋ Add Account</button></div>
    {error && <div className="accounts-alert">{error}</div>}

    <div className="account-summary-grid">
      <SummaryCard icon="◎" label="Total Users" value={summary.total} tone="blue" />
      <SummaryCard icon="✓" label="Active" value={summary.active} tone="green" />
      <SummaryCard icon="◷" label="Setup Required" value={summary.setup} tone="amber" />
      <SummaryCard icon="⊘" label="Deactivated" value={summary.deactivated} tone="slate" />
    </div>

    <div className="accounts-panel">
      <div className="accounts-toolbar account-filter-toolbar">
        <label className="account-search">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search users..." /></label>
        <div className="account-filters">
          <select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="ALL">All Role</option>{accountAccessOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="SETUP_REQUIRED">Setup Required</option><option value="DISABLED">Deactivated</option><option value="RESET_REQUIRED">Reset Required</option></select>
        </div>
      </div>
      {loading ? <div className="accounts-state">အချက်အလက် ရယူနေသည်...</div> : <div className="accounts-table-wrap"><table>
        <thead><tr><th>No</th><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
        <tbody>{visible.map((row, index) => <tr key={`${row.kind}-${row.id}`}>
          <td className="account-number">{index + 1}</td>
          <td><div className="account-person"><span>{row.name?.slice(0, 1).toUpperCase()}</span><div><b>{row.name}</b><small>{row.email}</small></div></div></td>
          <td>{row.kind === 'USER' && !row.isPrimaryAdmin
            ? <button className={`access-chip editable ${row.role.toLowerCase()}`} onClick={() => setChangeAccess({ ...row, nextRole: row.role })} aria-label={`Change role for ${row.name}`}>{roleLabels[row.role]}</button>
            : <span className={`access-chip ${row.isPrimaryAdmin ? 'primary-admin' : row.role.toLowerCase()}`}>{row.isPrimaryAdmin ? 'Main Admin' : roleLabels[row.role]}</span>}</td>
          <td><span className={`account-status ${row.status.toLowerCase()}`}>{statusLabel(row.status)}</span></td>
          <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : 'Never'}</td>
          <td><AccountActions row={row} onReset={() => resetLogin(row)} onDeactivate={() => setDeactivateTarget(row)} onReactivate={() => reactivate(row)} /></td>
        </tr>)}</tbody>
      </table>{!visible.length && <div className="accounts-state">No users match these filters.</div>}</div>}
    </div>

    {showAdd && <AccountDialog title="Add Account" onClose={() => setShowAdd(false)} onSubmit={addAccount} saving={saving} submitLabel="Add Account">
      <label>Full Name<input autoFocus required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email Address<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <RoleOptions value={form.role} onChange={role => setForm({ ...form, role })} />
    </AccountDialog>}

    {changeAccess && <AccountDialog title="Change Access" onClose={() => setChangeAccess(null)} onSubmit={saveAccess} saving={saving} submitLabel="Save Changes">
      <div className="current-access"><span>User</span><b>{changeAccess.name}</b></div>
      <RoleOptions value={changeAccess.nextRole} onChange={role => setChangeAccess({ ...changeAccess, nextRole: role })} />
    </AccountDialog>}

    {deactivateTarget && <ConfirmDeactivate user={deactivateTarget} busy={saving} onCancel={() => setDeactivateTarget(null)} onConfirm={deactivate} />}
    {linkResult && <LinkResult result={linkResult} onClose={() => setLinkResult(null)} />}
  </section>
}

function SummaryCard({ icon, label, value, tone }) {
  return <article className={`account-summary ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function RoleOptions({ value, onChange }) {
  return <fieldset className="role-options"><legend>Role</legend><div role="radiogroup" aria-label="Role">{accountAccessOptions.map(item => <button type="button" role="radio" aria-checked={value === item.value} className={value === item.value ? 'selected' : ''} onClick={() => onChange(item.value)} key={item.value}><i />{item.label}</button>)}</div></fieldset>
}

function AccountActions({ row, onReset, onDeactivate, onReactivate }) {
  const [open, setOpen] = useState(false)
  const actions = accountActionItems(row)
  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])
  if (row.isPrimaryAdmin) return <span className="protected-note">Protected</span>
  if (!actions.length) return <span className="no-actions">—</span>
  const run = action => { setOpen(false); action() }
  return <div className="account-action-menu" onClick={event => event.stopPropagation()}>
    <button className="account-kebab" aria-label={`Actions for ${row.name}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>⋮</button>
    {open && <div role="menu">{actions[0] === 'Reactivate'
      ? <button role="menuitem" onClick={() => run(onReactivate)}>Reactivate</button>
      : <><button role="menuitem" onClick={() => run(onReset)}>Reset Login</button><hr /><button role="menuitem" className="danger" onClick={() => run(onDeactivate)}>Deactivate</button></>}</div>}
  </div>
}

function AccountDialog({ title, onClose, onSubmit, saving, submitLabel, children }) {
  return <div className="account-modal" role="dialog" aria-modal="true"><form onSubmit={onSubmit}><header><h2>{title}</h2><button type="button" aria-label="Close" onClick={onClose}>×</button></header>{children}<footer><button type="button" onClick={onClose}>Cancel</button><button className="accounts-primary" disabled={saving}>{saving ? 'Saving...' : submitLabel}</button></footer></form></div>
}

function ConfirmDeactivate({ user, busy, onCancel, onConfirm }) {
  return <div className="account-modal" role="dialog" aria-modal="true"><div className="account-confirm"><header><h2>Deactivate this user?</h2><button type="button" aria-label="Close" onClick={onCancel}>×</button></header><p><b>{user.name}</b> will be signed out and cannot log in until this account is reactivated.</p><footer><button onClick={onCancel} disabled={busy}>Cancel</button><button className="danger-solid" onClick={onConfirm} disabled={busy}>{busy ? 'Deactivating...' : 'Deactivate'}</button></footer></div></div>
}

function LinkResult({ result, onClose }) {
  const [copyState, setCopyState] = useState({ copied: false, error: '' })
  const copy = async () => {
    const copied = await copyText(result.url)
    setCopyState(copied ? { copied: true, error: '' } : { copied: false, error: 'Copy failed. Select the link and copy it manually.' })
  }
  const linkLabel = result.kind === 'reset' ? 'Reset Link' : 'Setup Link'
  return <div className="account-modal" role="dialog" aria-modal="true"><div className="link-result"><header><h2>{result.title}</h2><button type="button" aria-label="Close" onClick={onClose}>×</button></header>{result.kind === 'setup' && <dl><div><dt>Name</dt><dd>{result.name}</dd></div><div><dt>Email</dt><dd>{result.email}</dd></div><div><dt>Role</dt><dd>{result.role}</dd></div></dl>}<label>{linkLabel}<input readOnly value={result.url} onFocus={event => event.currentTarget.select()} /></label>{copyState.error && <div className="copy-error" role="alert">{copyState.error}</div>}<footer><button onClick={onClose}>{result.kind === 'reset' ? 'Done' : 'Close'}</button><button className="accounts-primary" onClick={copy}>{copyState.copied ? 'Copied' : result.kind === 'reset' ? 'Copy Reset Link' : 'Copy Link'}</button></footer></div></div>
}

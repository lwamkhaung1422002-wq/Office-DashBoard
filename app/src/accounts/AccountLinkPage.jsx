import { useEffect, useState } from 'react'
import { api } from '../api.js'
import './accounts-access.css'

export default function AccountLinkPage({ mode }) {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [details, setDetails] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState({ loading: true, error: '', complete: false })
  const endpoint = mode === 'setup' ? '/auth/account/setup' : '/auth/account/reset'

  useEffect(() => {
    api(`${endpoint}?token=${encodeURIComponent(token)}`)
      .then(data => { setDetails(data); setState({ loading: false, error: '', complete: false }) })
      .catch(error => setState({ loading: false, error: error.message, complete: false }))
  }, [endpoint, token])

  const submit = async event => {
    event.preventDefault()
    if (password.length < 12) return setState(value => ({ ...value, error: 'Password သည် အနည်းဆုံး 12 လုံး ရှိရမည်။' }))
    if (password !== confirm) return setState(value => ({ ...value, error: 'Password နှစ်ခု မတူပါ။' }))
    setState(value => ({ ...value, loading: true, error: '' }))
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify({ token, password }) })
      setState({ loading: false, error: '', complete: true })
    } catch (error) {
      setState({ loading: false, error: error.message, complete: false })
    }
  }

  return <main className="account-link-page"><section>
    <div className="account-link-mark">▣</div>
    <span>Government Data Management System</span>
    <h1>{mode === 'setup' ? 'အကောင့် စတင်အသုံးပြုရန်' : 'Password အသစ်သတ်မှတ်ရန်'}</h1>
    {state.loading && !details ? <p>Link ကို စစ်ဆေးနေသည်...</p> : state.error && !details ? <div className="accounts-alert">{state.error}</div> : state.complete ? <><div className="account-success">✓ Password ကို အောင်မြင်စွာသတ်မှတ်ပြီးပါပြီ။</div><button className="accounts-primary" onClick={() => { window.location.href = '/' }}>Login သို့သွားရန်</button></> : <form onSubmit={submit}><div className="link-identity"><b>{details?.name}</b><small>{details?.email}</small></div>{state.error && <div className="accounts-alert">{state.error}</div>}<label>Password အသစ်<input type="password" required minLength="12" value={password} onChange={event => setPassword(event.target.value)} /></label><label>Password အတည်ပြုရန်<input type="password" required minLength="12" value={confirm} onChange={event => setConfirm(event.target.value)} /></label><button className="accounts-primary" disabled={state.loading}>{state.loading ? 'သိမ်းဆည်းနေသည်...' : 'Password သိမ်းဆည်းရန်'}</button></form>}
  </section></main>
}

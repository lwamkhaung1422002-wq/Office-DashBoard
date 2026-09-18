import { useState } from 'react'
import { login } from '../api.js'

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login(email, password)
      onLogin(user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return <main className="login"><form className="login-card" onSubmit={submit}>
    <div className="logo">GO</div><span className="eyebrow">အစိုးရရုံး</span>
    <h1>စီမံခန့်ခွဲရေးစနစ်</h1><p>အချက်အလက် စုဆောင်းခြင်း၊ စီမံခြင်းနှင့် အစီရင်ခံခြင်း</p>
    <label>အသုံးပြုသူအီးမေးလ်<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required /></label>
    <label>စကားဝှက်<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength="8" required /></label>
    {error && <div className="login-error" role="alert">{error}</div>}
    <button className="primary full" type="submit" disabled={loading}>{loading ? 'စစ်ဆေးနေသည်…' : 'ဝင်ရောက်ရန်'} <b>→</b></button>
    <small>လုံခြုံသော စီမံခန့်ခွဲရေးဝင်ရောက်မှု</small>
  </form></main>
}


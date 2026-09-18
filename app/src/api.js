const API_BASE = import.meta.env.VITE_API_URL || '/api'

export function getToken() {
  return sessionStorage.getItem('office_access_token')
}

export async function api(path, options = {}) {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'တောင်းဆိုမှု မအောင်မြင်ပါ')
    error.code = payload.error?.code
    error.details = payload.error?.details
    throw error
  }
  return payload.data
}

export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  sessionStorage.setItem('office_access_token', data.token)
  sessionStorage.setItem('office_user', JSON.stringify(data.user))
  return data.user
}

export function logout() {
  sessionStorage.removeItem('office_access_token')
  sessionStorage.removeItem('office_user')
}

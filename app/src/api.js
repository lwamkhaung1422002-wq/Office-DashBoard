const API_BASE = import.meta.env.VITE_API_URL || '/api'

export function getToken() {
  return sessionStorage.getItem('office_access_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = Object.assign(new Error(payload.error?.message || 'တောင်းဆိုမှု မအောင်မြင်ပါ'), {
      code: payload.error?.code,
      details: payload.error?.details,
    })
    throw error
  }
  return payload
}

export async function api(path, options = {}) {
  return (await request(path, options)).data
}

export function apiEnvelope(path, options = {}) {
  return request(path, options)
}

export async function apiBlob(path) {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error?.message || 'ဖိုင်ကို ဖွင့်၍မရပါ')
  }
  return response.blob()
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

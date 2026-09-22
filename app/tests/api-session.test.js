import { beforeEach, describe, expect, it, vi } from 'vitest'

function storage() {
  const data = new Map()
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  }
}

describe('refresh-cookie client session', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('sessionStorage', storage())
  })

  it('uses one refresh request for concurrent 401 responses and retries both calls', async () => {
    let refreshes = 0
    let protectedCalls = 0
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshes += 1
        return new Response(JSON.stringify({ data: { accessToken: 'fresh-token', user: { id: 'u1', role: 'ADMIN' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      protectedCalls += 1
      if (protectedCalls <= 2) return new Response(JSON.stringify({ error: { message: 'expired' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { api } = await import('../src/api.js')
    const [one, two] = await Promise.all([api('/one'), api('/two')])
    expect(one.ok && two.ok).toBe(true)
    expect(refreshes).toBe(1)
    expect(sessionStorage.getItem('office_access_token')).toBe('fresh-token')
  })

  it('restores and clears a cookie-backed session', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).endsWith('/auth/refresh')) return new Response(JSON.stringify({ data: { accessToken: 'restored', user: { id: 'u1', role: 'VIP_VIEWER' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      return new Response(null, { status: 204 })
    }))
    const { bootstrapSession, getToken, logout } = await import('../src/api.js')
    await expect(bootstrapSession()).resolves.toMatchObject({ role: 'VIP_VIEWER' })
    expect(getToken()).toBe('restored')
    await logout()
    expect(getToken()).toBeNull()
  })
})

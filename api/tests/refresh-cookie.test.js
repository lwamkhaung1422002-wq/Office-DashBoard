import { afterEach, describe, expect, it } from 'vitest'
import { clearRefreshCookie, readRefreshCookie, refreshCookieName, setRefreshCookie } from '../server/modules/auth/refresh-cookie.js'

describe('refresh cookie transport', () => {
  afterEach(() => { delete process.env.NODE_ENV })

  it('uses an HttpOnly scoped cookie and never requires a JSON refresh token', () => {
    const calls = []
    const response = { cookie: (...args) => calls.push(args) }
    setRefreshCookie(response, 'raw-refresh-value')
    expect(calls[0][0]).toBe(refreshCookieName)
    expect(calls[0][1]).toBe('raw-refresh-value')
    expect(calls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/api/auth', secure: false })
    expect(readRefreshCookie({ headers: { cookie: `theme=dark; ${refreshCookieName}=raw-refresh-value` } })).toBe('raw-refresh-value')
  })

  it('marks production cookies Secure and clears the same cookie scope', () => {
    process.env.NODE_ENV = 'production'
    const calls = []
    const response = { clearCookie: (...args) => calls.push(args) }
    clearRefreshCookie(response)
    expect(calls[0]).toEqual([refreshCookieName, expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth' })])
  })
})

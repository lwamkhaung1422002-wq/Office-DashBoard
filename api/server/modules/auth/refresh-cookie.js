export const refreshCookieName = 'office_refresh_session'

const refreshDays = () => Math.max(1, Math.min(90, Number(process.env.REFRESH_TOKEN_DAYS || 14)))

export function readRefreshCookie(request) {
  const cookie = request.headers.cookie || ''
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === refreshCookieName) return decodeURIComponent(value.join('='))
  }
  return null
}

export function setRefreshCookie(response, token) {
  response.cookie(refreshCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: refreshDays() * 86_400_000,
  })
}

export function clearRefreshCookie(response) {
  response.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  })
}

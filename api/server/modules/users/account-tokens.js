import { createHash, randomBytes } from 'node:crypto'

export const hashAccountToken = token => createHash('sha256').update(token).digest('hex')

export function createAccountToken() {
  const rawToken = randomBytes(48).toString('base64url')
  return { rawToken, tokenHash: hashAccountToken(rawToken) }
}

function futureDate(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

export const inviteExpiresAt = () => futureDate(Math.max(1, Math.min(168, Number(process.env.ACCOUNT_INVITE_HOURS || 48))))
export const resetExpiresAt = () => futureDate(Math.max(1, Math.min(24, Number(process.env.ACCOUNT_RESET_HOURS || 2))))

function appUrl(path, rawToken) {
  const base = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
  return `${base}${path}?token=${encodeURIComponent(rawToken)}`
}

export const setupUrl = rawToken => appUrl('/account/setup', rawToken)
export const resetUrl = rawToken => appUrl('/account/reset', rawToken)

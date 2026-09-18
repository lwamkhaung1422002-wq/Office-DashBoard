export const ACCESS_RANK = Object.freeze({ NORMAL: 1, VIP: 2, ADMIN: 3 })

export function allowedAccessLevels(role) {
  if (role === 'ADMIN') return ['NORMAL', 'VIP', 'ADMIN']
  if (role === 'VIP_VIEWER') return ['NORMAL', 'VIP']
  return ['NORMAL']
}

export function canAccess(role, level) {
  const roleRank = role === 'ADMIN' ? 3 : role === 'VIP_VIEWER' ? 2 : 1
  return roleRank >= (ACCESS_RANK[level] || 99)
}

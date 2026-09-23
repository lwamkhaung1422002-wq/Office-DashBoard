export const accountAccessOptions = [
  { value: 'NORMAL_VIEWER', label: 'Normal' },
  { value: 'VIP_VIEWER', label: 'VIP' },
  { value: 'ADMIN', label: 'Admin' },
]

export function accountActionItems(row) {
  if (row.isPrimaryAdmin || row.kind === 'INVITATION' || row.status === 'SETUP_REQUIRED' || row.status === 'RESET_REQUIRED') return []
  if (row.status === 'DISABLED') return ['Reactivate']
  if (row.status === 'ACTIVE') return ['Reset Login', 'Deactivate']
  return []
}

export function accountMenuPosition({ buttonRect, menuWidth, menuHeight, viewportWidth, viewportHeight, margin = 8, gap = 5 }) {
  const width = menuWidth || 158
  const height = menuHeight || 91
  const maxLeft = Math.max(margin, viewportWidth - width - margin)
  const left = Math.min(Math.max(buttonRect.right - width, margin), maxLeft)
  const belowTop = buttonRect.bottom + gap
  const opensUpward = belowTop + height > viewportHeight - margin
  const requestedTop = opensUpward ? buttonRect.top - gap - height : belowTop
  const maxTop = Math.max(margin, viewportHeight - height - margin)
  const top = Math.min(Math.max(requestedTop, margin), maxTop)
  return { position: 'fixed', left, top, opensUpward }
}

export function runAccountAction(setOpen, action) {
  setOpen(false)
  action()
}

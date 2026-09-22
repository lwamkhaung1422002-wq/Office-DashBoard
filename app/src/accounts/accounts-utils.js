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

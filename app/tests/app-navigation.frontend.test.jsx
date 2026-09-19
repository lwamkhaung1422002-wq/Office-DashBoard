import { describe, expect, it } from 'vitest'
import { adminNavigation } from '../src/admin-navigation.js'

describe('Admin navigation', () => {
  it('removes the dedicated Documents entry and uses the exact Dashboard label', () => {
    const labels = adminNavigation.map(([, label]) => label)
    expect(labels).not.toContain('စာရွက်စာတမ်းများ')
    expect(labels).not.toContain('အစီရင်ခံစာများ')
    expect(labels.filter(label => label === 'Dashboard')).toHaveLength(1)
  })
})

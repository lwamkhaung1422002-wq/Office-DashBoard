import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { accountAccessOptions } from '../src/accounts/AccountsAccess.jsx'

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/accounts/AccountsAccess.jsx'), 'utf8')

describe('Accounts & Access acceptance UI', () => {
  it('offers only the three assignable access levels', () => {
    expect(accountAccessOptions).toEqual([
      { value: 'ADMIN', label: 'Admin' },
      { value: 'VIP_VIEWER', label: 'VIP Viewer' },
      { value: 'NORMAL_VIEWER', label: 'Normal Viewer' },
    ])
    expect(accountAccessOptions.some(option => option.label === 'Main Admin')).toBe(false)
  })

  it('keeps account creation passwordless and exposes the required controls', () => {
    const addDialog = source.slice(source.indexOf('{showAdd &&'), source.indexOf('{changeAccess &&'))
    expect(addDialog).not.toContain('type="password"')
    expect(addDialog).toContain('Full Name *')
    expect(addDialog).toContain('Email Address *')
    expect(addDialog).toContain('Access *')
    expect(source).toContain('Total Accounts')
    expect(source).toContain('Setup Required')
    expect(source).toContain('All Access')
    expect(source).toContain('All Status')
    expect(source).toContain('Generate New Setup Link')
    expect(source).toContain('Change Access')
    expect(source).toContain('Reset Login')
    expect(source).toContain('Protected Main Admin')
  })
})

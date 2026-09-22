import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { inspectSheet } from '../server/modules/imports/excel.service.js'

function sheet(rows) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Budget')
  rows.forEach(row => worksheet.addRow(row))
  return worksheet
}

describe('Excel inspection', () => {
  it('detects a title row, headers, types, blanks, and preview data', () => {
    const worksheet = sheet([
      ['2026 Budget Register'],
      ['Department', 'Budget', 'Date', 'Approved'],
      ['Finance', 500000, new Date('2026-01-15'), true],
      [],
      ['HR', 250000, new Date('2026-02-01'), false],
    ])
    const result = inspectSheet(worksheet)
    expect(result.headerRow).toBe(2)
    expect(result.fields.map(field => [field.key, field.type])).toEqual([
      ['department', 'TEXT'], ['budget', 'NUMBER'], ['date', 'DATE'], ['approved', 'BOOLEAN'],
    ])
    expect(result.totalRows).toBe(2)
    expect(result.rows[0].data.budget).toBe(500000)
  })

  it('rejects ambiguous duplicate headers instead of guessing a mapping', () => {
    const worksheet = sheet([['Department', 'Department'], ['A', 'B']])
    expect(() => inspectSheet(worksheet)).toThrowError(expect.objectContaining({ code: 'DUPLICATE_HEADERS' }))
  })

  it('recognizes and normalizes day-first date strings used by Excel exports', () => {
    const worksheet = sheet([
      ['Name', 'Amount', 'Date'],
      ['Alpha', 10.5, '15/10/2017'],
      ['Beta', 20, '16/08/2016'],
    ])
    const result = inspectSheet(worksheet)
    expect(result.fields.map(field => [field.key, field.type])).toEqual([
      ['name', 'TEXT'], ['amount', 'NUMBER'], ['date', 'DATE'],
    ])
    expect(result.rows.map(row => row.data)).toEqual([
      { name: 'Alpha', amount: 10.5, date: '2017-10-15T00:00:00.000Z' },
      { name: 'Beta', amount: 20, date: '2016-08-16T00:00:00.000Z' },
    ])
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Categories from '../src/categories/Categories.jsx'
import { flattenCategories } from '../src/categories/category-utils.js'

describe('Categories frontend', () => {
  it('supports arbitrary hierarchy depth and readable paths', () => {
    const tree = [{ id: '1', name: 'Root', children: [{ id: '2', name: 'Child', children: [{ id: '3', name: 'Deep', children: [] }] }] }]
    expect(flattenCategories(tree).map(item => item.path)).toEqual(['Root', 'Root / Child', 'Root / Child / Deep'])
  })

  it('renders a loading state without exposing technical category fields', () => {
    globalThis.sessionStorage = { getItem: () => JSON.stringify({ role: 'VIEWER' }) }
    const html = renderToStaticMarkup(<Categories />)
    expect(html).toContain('အမျိုးအစားများ')
    expect(html).toContain('ဖွင့်နေသည်')
    expect(html).not.toContain('parentId')
    expect(html).not.toContain('sortOrder')
  })
})

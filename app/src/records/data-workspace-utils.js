import { api } from '../api.js'

export function filterFolderTree(nodes, search = '') {
  const needle = search.trim().toLocaleLowerCase()
  return nodes.flatMap(node => {
    const children = filterFolderTree(node.children || [], search)
    return !needle || node.name.toLocaleLowerCase().includes(needle) || children.length ? [{ ...node, children }] : []
  })
}

export function recordQueryParams({ dataCollectionId, search = '', filters = {}, sortBy = 'updatedAt', sortDirection = 'desc', cursor = null, limit = 50 }) {
  return new URLSearchParams({
    dataCollectionId,
    includeDescendants: 'false',
    limit: String(limit),
    sortBy,
    sortDirection,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(Object.keys(filters).length ? { filters: JSON.stringify(filters) } : {}),
    ...(cursor ? { cursor } : {}),
  })
}

export function fieldInputType(type) {
  if (type === 'NUMBER') return 'number'
  if (type === 'DATE') return 'date'
  if (type === 'BOOLEAN') return 'checkbox'
  if (type === 'ENUM') return 'select'
  return 'text'
}

export function generateRecordTitle({ fields = [], payload = {}, existingTitle = '', collectionName = '' }) {
  if (existingTitle.trim()) return existingTitle.trim()
  const textField = fields.find(field => field.type === 'TEXT' && String(payload[field.key] ?? '').trim())
  if (textField) return String(payload[textField.key]).trim()
  return `Record - ${collectionName.trim() || 'Structured Data'}`
}

export function handleCollectionEnter(event, item, selectedId, onOpen) {
  if (event.key !== 'Enter' || selectedId !== item.id) return false
  event.preventDefault()
  onOpen(item)
  return true
}

export function clearCollectionContext({ setCollection, setSelectedCollectionId, onClearCollection }) {
  setCollection(null)
  setSelectedCollectionId(null)
  onClearCollection?.()
}

export function dataCollectionDetailsRequest(id) {
  return api(`/data/collections/${id}`)
}

export function createRecordRequest({ title, accessLevel, payload, categoryId, dataCollectionId }) {
  return api('/admin/data', { method: 'POST', body: JSON.stringify({ title, accessLevel, payload, categoryId, dataCollectionId }) })
}

export function updateRecordRequest(id, body) {
  return api(`/admin/data/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function archiveRecordRequest(id) {
  return api(`/admin/data/${id}/archive`, { method: 'POST' })
}

export function widgetFieldChoices(fields = [], chartType = 'KPI') {
  const available = Array.isArray(fields) ? fields : []
  return {
    dimensions: available.filter(field => chartType === 'LINE' ? field.type === 'DATE' : ['TEXT', 'ENUM'].includes(field.type)),
    measures: available.filter(field => field.type === 'NUMBER'),
  }
}

export function widgetFormError(form, fields) {
  const { dimensions, measures } = widgetFieldChoices(fields, form.chartType)
  if (!form.title.trim()) return 'Enter a widget title.'
  if (['PIE', 'BAR', 'LINE'].includes(form.chartType)) {
    if (!dimensions.length) return form.chartType === 'LINE' ? 'This data file needs a Date field for a Line chart.' : 'This data file needs a Text or Select field for this chart.'
    if (!dimensions.some(field => field.id === form.dimensionFieldId)) return 'Select a valid Group By field.'
  }
  if (form.aggregation !== 'COUNT') {
    if (!measures.length) return 'This data file needs a Number field for this calculation.'
    if (!measures.some(field => field.id === form.measureFieldId)) return 'Select a valid Number field.'
  }
  return ''
}

export function widgetRequestBody(form, dataCollectionId) {
  return {
    title: form.title.trim(),
    dataCollectionId,
    chartType: form.chartType,
    dimensionFieldId: form.dimensionFieldId || null,
    measureFieldId: form.aggregation === 'COUNT' ? null : form.measureFieldId || null,
    aggregation: form.aggregation,
    timeGrouping: form.chartType === 'LINE' ? form.timeGrouping || 'MONTH' : null,
    accessLevel: form.accessLevel,
    sortOrder: Number(form.sortOrder || 0),
    isActive: true,
  }
}

export async function loadCollectionDashboard(dataCollectionId) {
  const widgets = await api(`/admin/dashboard-widgets?dataCollectionId=${encodeURIComponent(dataCollectionId)}`)
  return Promise.all(widgets.map(async widget => {
    const preview = await api(`/admin/dashboard-widgets/${widget.id}/preview`)
    return { widget, data: preview.data }
  }))
}

export function previewDashboardWidget(body) {
  return api('/admin/dashboard-widgets/preview', { method: 'POST', body: JSON.stringify(body) })
}

export function saveDashboardWidget(body, widgetId = null) {
  return api(widgetId ? `/admin/dashboard-widgets/${widgetId}` : '/admin/dashboard-widgets', { method: widgetId ? 'PATCH' : 'POST', body: JSON.stringify(body) })
}

export function archiveDashboardWidget(id) {
  return api(`/admin/dashboard-widgets/${id}/archive`, { method: 'POST' })
}

export function reorderDashboardWidgets(items) {
  return Promise.all(items.map((item, sortOrder) => api(`/admin/dashboard-widgets/${item.widget.id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder }) })))
}

export function topSeriesWithOthers(series = [], limit = 9) {
  if (series.length <= limit) return series
  const visible = series.slice(0, limit)
  const otherValue = series.slice(limit).reduce((total, item) => total + Number(item.value || 0), 0)
  return [...visible, { label: 'Others', value: otherValue }]
}

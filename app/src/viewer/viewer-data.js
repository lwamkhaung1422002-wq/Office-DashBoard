import { api, apiEnvelope } from '../api.js'

export function loadViewerOverview() {
  return Promise.all([api('/categories'), api('/data/collections'), api('/dashboard')])
}

export function loadViewerItems({ categoryId, collectionId, search }) {
  const params = new URLSearchParams({ limit: '50' })
  if (categoryId) params.set('categoryId', categoryId)
  if (search) params.set('search', search)
  const documentParams = new URLSearchParams(params)
  if (collectionId) params.set('dataCollectionId', collectionId)
  return Promise.all([apiEnvelope(`/data?${params}`), apiEnvelope(`/documents?${documentParams}`)])
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api.js'

export const categoryKeys = {
  all: ['file-manager'],
  tree: search => ['file-manager', 'tree', search],
  contents: id => ['file-manager', 'contents', id || 'home'],
}

export function useCategoryTree({ search = '' } = {}) {
  return useQuery({
    queryKey: categoryKeys.tree(search),
    queryFn: () => api(`/categories?search=${encodeURIComponent(search)}&includeArchived=false`),
    staleTime: 15_000,
    placeholderData: previous => previous,
  })
}

export async function folderContentsRequest(folderId) {
  if (!folderId) return null
  const [details, dataItems, documents] = await Promise.all([
    api(`/categories/${folderId}`),
    api(`/data/collections?categoryId=${encodeURIComponent(folderId)}`),
    api(`/documents?categoryId=${encodeURIComponent(folderId)}&includeDescendants=false&limit=100`),
  ])
  return {
    folder: details.category,
    breadcrumb: details.breadcrumb,
    folders: details.children || [],
    dataItems: dataItems || [],
    documents: documents || [],
  }
}

export function useFolderContents(folderId) {
  return useQuery({
    queryKey: categoryKeys.contents(folderId),
    queryFn: () => folderContentsRequest(folderId),
    enabled: Boolean(folderId),
    staleTime: 8_000,
  })
}

export function categoryMutationRequest({ mode, category, values }) {
  const base = '/admin/categories'
  if (mode === 'root' || mode === 'child') return api(base, { method: 'POST', body: JSON.stringify(values) })
  if (mode === 'edit') return api(`${base}/${category.id}`, { method: 'PATCH', body: JSON.stringify(values) })
  if (mode === 'move') return api(`${base}/${category.id}/move`, { method: 'POST', body: JSON.stringify(values) })
  throw new Error('မသိရှိသော ဖိုင်တွဲလုပ်ဆောင်ချက်ဖြစ်ပါသည်။')
}

export function useCategoryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: categoryMutationRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  })
}

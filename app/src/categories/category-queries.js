import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api.js'

export const categoryKeys = {
  all: ['categories'],
  tree: (search, includeArchived) => ['categories', 'tree', { search, includeArchived }],
  detail: id => ['categories', 'detail', id],
}

export function useCategoryTree({ search = '', includeArchived = false, enabled = true } = {}) {
  return useQuery({
    queryKey: categoryKeys.tree(search, includeArchived),
    queryFn: () => api(`/categories?search=${encodeURIComponent(search)}&includeArchived=${includeArchived}`),
    enabled,
    staleTime: 15_000,
    placeholderData: previous => previous,
  })
}

export function useCategoryDetails(id) {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => api(`/categories/${id}`),
    enabled: Boolean(id),
    staleTime: 10_000,
  })
}

export function categoryMutationRequest({ mode, category, values }) {
  const base = '/admin/categories'
  if (mode === 'root' || mode === 'child') return api(base, { method: 'POST', body: JSON.stringify(values) })
  if (mode === 'edit') return api(`${base}/${category.id}`, { method: 'PATCH', body: JSON.stringify(values) })
  if (mode === 'move') return api(`${base}/${category.id}/move`, { method: 'POST', body: JSON.stringify(values) })
  if (mode === 'archive') return api(`${base}/${category.id}/archive`, { method: 'POST' })
  if (mode === 'restore') return api(`${base}/${category.id}/restore`, { method: 'POST' })
  throw new Error('မသိရှိသော လုပ်ဆောင်ချက်ဖြစ်ပါသည်။')
}

export function useCategoryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: categoryMutationRequest,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all })
      if (variables.category?.id) await queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.category.id) })
    },
  })
}

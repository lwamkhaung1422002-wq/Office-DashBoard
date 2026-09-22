export function semanticFileType(value = '') {
  const normalized = String(value).toUpperCase()
  if (normalized === 'FOLDER') return 'FOLDER'
  if (normalized === 'DATA' || normalized === 'EXCEL' || normalized === 'XLS' || normalized === 'XLSX') return 'DATA'
  if (normalized === 'PDF') return 'PDF'
  return 'IMAGE'
}

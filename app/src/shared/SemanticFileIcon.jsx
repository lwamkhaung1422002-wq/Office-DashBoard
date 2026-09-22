import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import ImageRounded from '@mui/icons-material/ImageRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import TableChartRounded from '@mui/icons-material/TableChartRounded'

export function SemanticFileIcon({ type, open = false }) {
  if (type === 'FOLDER') return open ? <FolderOpenRounded /> : <FolderRounded />
  if (type === 'DATA') return <TableChartRounded />
  if (type === 'PDF') return <PictureAsPdfRounded />
  return <ImageRounded />
}

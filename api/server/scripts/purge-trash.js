import 'dotenv/config'
import { prisma } from '../lib/prisma.js'
import { createStorage } from '../lib/storage.js'
import { createTrashService } from '../modules/trash/trash.service.js'

try {
  const purged = await createTrashService(prisma, createStorage()).purgeExpired()
  process.stdout.write(`Purged ${purged.length} expired trash item(s).\n`)
} finally {
  await prisma.$disconnect()
}

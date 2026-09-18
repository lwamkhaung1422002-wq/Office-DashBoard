import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createStorage } from '../server/lib/storage.js'

describe('storage delete abstraction', () => {
  it('removes local physical objects idempotently', async () => {
    const root = await mkdtemp(join(tmpdir(), 'office-storage-'))
    try {
      const storage = createStorage({ STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: root })
      await storage.putObject({ key: 'documents/item.pdf', body: Buffer.from('content') })
      expect((await readFile(join(root, 'documents', 'item.pdf'))).toString()).toBe('content')
      await storage.deleteObject('documents/item.pdf')
      await storage.deleteObject('documents/item.pdf')
      await expect(storage.getObject('documents/item.pdf')).rejects.toMatchObject({ code: 'ENOENT' })
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})

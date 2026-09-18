import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, resolve, sep } from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

function safeLocalPath(root, key) {
  const target = resolve(root, key)
  const normalizedRoot = resolve(root)
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) throw new Error('Invalid storage key')
  return target
}

export function makeStorageKey(prefix, fileName) {
  const extension = basename(fileName).split('.').at(-1)?.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension ? `.${extension}` : ''}`
}

export function createStorage(customEnv) {
  const env = customEnv || {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
    STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR || 'storage',
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  }
  if (env.STORAGE_DRIVER === 's3') {
    const client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: env.S3_ACCESS_KEY_ID ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined,
    })
    return {
      async putObject({ key, body, contentType }) {
        await client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }))
        return key
      },
      async getObject(key) {
        const response = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
        return Buffer.from(await response.Body.transformToByteArray())
      },
      async deleteObject(key) {
        await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
      },
    }
  }
  const root = resolve(process.cwd(), env.STORAGE_LOCAL_DIR)
  return {
    async putObject({ key, body }) {
      const target = safeLocalPath(root, key)
      await mkdir(resolve(target, '..'), { recursive: true })
      await writeFile(target, body)
      return key
    },
    getObject(key) {
      return readFile(safeLocalPath(root, key))
    },
    deleteObject(key) {
      return rm(safeLocalPath(root, key), { force: true })
    },
  }
}

import { createApp } from './app.js'
import { getEnv } from './config/env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'

const env = getEnv()
const server = createApp().listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, 'API listening'))

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down')
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

import 'dotenv/config'
import { createApp } from './app.js'
import { prisma } from './lib/prisma.js'

const port = Number(process.env.API_PORT || 3001)
const server = createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`))

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

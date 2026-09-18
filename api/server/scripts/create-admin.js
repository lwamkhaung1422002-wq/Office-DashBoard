import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || 'System Administrator'

if (!email || !password || password.length < 12) {
  console.error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.')
  process.exitCode = 1
} else {
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: 'ADMIN', isActive: true },
    create: { email, name, passwordHash, role: 'ADMIN' },
    select: { id: true, email: true, name: true, role: true },
  })
  console.log(`Administrator ready: ${user.email}`)
}

await prisma.$disconnect()

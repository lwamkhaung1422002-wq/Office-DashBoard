import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || 'System Administrator'

if (!email || !password || password.length < 12) {
  const currentPrimary = await prisma.user.findFirst({ where: { isPrimaryAdmin: true }, select: { email: true } })
  if (currentPrimary) {
    console.log(`Main Administrator ready: ${currentPrimary.email}`)
  } else {
    const candidates = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true, email: true }, take: 2 })
    if (candidates.length === 1) {
      await prisma.user.update({ where: { id: candidates[0].id }, data: { isPrimaryAdmin: true } })
      console.log(`Main Administrator assigned: ${candidates[0].email}`)
    } else {
      console.error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters when there is not exactly one active administrator.')
      process.exitCode = 1
    }
  }
} else {
  const passwordHash = await bcrypt.hash(password, 12)
  const existingPrimary = await prisma.user.findFirst({ where: { isPrimaryAdmin: true }, select: { email: true } })
  const isPrimaryAdmin = !existingPrimary || existingPrimary.email === email
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: 'ADMIN', isActive: true, mustChangePassword: false, loginResetRequired: false, isPrimaryAdmin },
    create: { email, name, passwordHash, role: 'ADMIN', isActive: true, mustChangePassword: false, loginResetRequired: false, isPrimaryAdmin },
    select: { id: true, email: true, name: true, role: true, isPrimaryAdmin: true },
  })
  console.log(`Administrator ready: ${user.email}`)
  if (!user.isPrimaryAdmin) console.log(`Main Admin remains: ${existingPrimary.email}`)
}

await prisma.$disconnect()

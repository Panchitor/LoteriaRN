import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
dotenv.config()

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const connectionString = required('DATABASE_URL')
const adminUsername = required('SEED_ADMIN_USERNAME')
const adminPassword = required('SEED_ADMIN_PASSWORD')
if (adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters')
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const hash = await bcrypt.hash(adminPassword, 12)
  
  const user = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      password_hash: hash,
      role: 'ADMIN'
    }
  })
  
  console.log('Admin user ensured:', user.username)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

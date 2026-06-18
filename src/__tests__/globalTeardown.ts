import fs from 'fs'
import path from 'path'
import { TEST_CLERK_ID_A, TEST_CLERK_ID_B } from './globalSetup'

function loadTestEnv() {
  const envPath = path.resolve(__dirname, '.env.test')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

export async function teardown() {
  loadTestEnv()

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('PLACEHOLDER')) {
    return
  }

  const { PrismaClient } = await import('@prisma/client')
  const { PrismaNeon } = await import('@prisma/adapter-neon')

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter, log: ['error'] })

  try {
    for (const clerkId of [TEST_CLERK_ID_A, TEST_CLERK_ID_B]) {
      const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
      if (!user) continue

      await purgeUserTestData(prisma, user.id)
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function purgeUserTestData(
  prisma: import('@prisma/client').PrismaClient,
  userId: string
) {
  // Audit logs first (reference entries, user)
  await prisma.auditLog.deleteMany({ where: { userId } })

  // Entry children before entries
  const entries = await prisma.entry.findMany({ where: { userId }, select: { id: true } })
  const entryIds = entries.map((e) => e.id)
  if (entryIds.length > 0) {
    await prisma.tag.deleteMany({ where: { entryId: { in: entryIds } } })
    await prisma.entryWitness.deleteMany({ where: { entryId: { in: entryIds } } })
    await prisma.entryEvidence.deleteMany({ where: { entryId: { in: entryIds } } })
    await prisma.attachment.deleteMany({ where: { entryId: { in: entryIds } } })
    await prisma.caseItem.deleteMany({ where: { entryId: { in: entryIds } } })
  }
  await prisma.entryRevision.deleteMany({ where: { userId } })
  await prisma.batchJob.deleteMany({ where: { userId } })
  await prisma.entry.deleteMany({ where: { userId } })

  // Recording children before recordings
  const recordings = await prisma.recording.findMany({ where: { userId }, select: { id: true } })
  const recordingIds = recordings.map((r) => r.id)
  if (recordingIds.length > 0) {
    await prisma.recordingTranscript.deleteMany({ where: { recordingId: { in: recordingIds } } })
    await prisma.recordingReport.deleteMany({ where: { recordingId: { in: recordingIds } } })
    await prisma.caseItem.deleteMany({ where: { recordingId: { in: recordingIds } } })
  }
  await prisma.recording.deleteMany({ where: { userId } })

  // MessageAnalysis
  await prisma.caseItem.deleteMany({
    where: { messageAnalysis: { userId } },
  })
  await prisma.messageAnalysis.deleteMany({ where: { userId } })

  // User-cascading models (InsightReport, ImportJob, StoredWitness, ClaritySession, ContextSnapshot)
  // These cascade automatically when user is deleted, but we keep the user record.
  await prisma.insightReport.deleteMany({ where: { userId } })
  await prisma.contextSnapshot.deleteMany({ where: { userId } })
  await prisma.claritySession.deleteMany({ where: { userId } })
  await prisma.storedWitness.deleteMany({ where: { userId } })
  await prisma.importJob.deleteMany({ where: { userId } })
}

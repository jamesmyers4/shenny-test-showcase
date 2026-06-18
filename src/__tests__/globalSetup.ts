import fs from 'fs'
import path from 'path'

export const TEST_CLERK_ID_A = 'test_clerk_user_a'
export const TEST_CLERK_ID_B = 'test_clerk_user_b'
export const TEST_EMAIL_A = 'test-user-a@example.internal'
export const TEST_EMAIL_B = 'test-user-b@example.internal'

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

export async function setup() {
  loadTestEnv()

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('PLACEHOLDER')) {
    throw new Error(
      'TEST SETUP: DATABASE_URL is not configured in src/__tests__/.env.test. ' +
        'Set it to your Neon test database URL with ?schema=test.'
    )
  }

  // Dynamic import so env is loaded before Prisma reads DATABASE_URL
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaNeon } = await import('@prisma/adapter-neon')

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter, log: ['error'] })

  try {
    // Purge any stale data from prior test runs that didn't teardown cleanly
    for (const clerkId of [TEST_CLERK_ID_A, TEST_CLERK_ID_B]) {
      const existing = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
      if (existing) await purgeUserData(prisma, existing.id)
    }

    await prisma.user.upsert({
      where: { clerkId: TEST_CLERK_ID_A },
      update: { isOnboardingComplete: true, deletedAt: null },
      create: {
        clerkId: TEST_CLERK_ID_A,
        email: TEST_EMAIL_A,
        isOnboardingComplete: true,
        coParentNames: ['Test Co-Parent A'],
        childrenNames: ['Test Child A'],
      },
    })

    await prisma.user.upsert({
      where: { clerkId: TEST_CLERK_ID_B },
      update: { isOnboardingComplete: true, deletedAt: null },
      create: {
        clerkId: TEST_CLERK_ID_B,
        email: TEST_EMAIL_B,
        isOnboardingComplete: true,
        coParentNames: ['Test Co-Parent B'],
        childrenNames: ['Test Child B'],
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function purgeUserData(
  prisma: import('@prisma/client').PrismaClient,
  userId: string
) {
  await prisma.auditLog.deleteMany({ where: { userId } })

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

  const recordings = await prisma.recording.findMany({ where: { userId }, select: { id: true } })
  const recordingIds = recordings.map((r) => r.id)
  if (recordingIds.length > 0) {
    await prisma.recordingTranscript.deleteMany({ where: { recordingId: { in: recordingIds } } })
    await prisma.recordingReport.deleteMany({ where: { recordingId: { in: recordingIds } } })
    await prisma.caseItem.deleteMany({ where: { recordingId: { in: recordingIds } } })
  }
  await prisma.recording.deleteMany({ where: { userId } })

  await prisma.caseItem.deleteMany({ where: { messageAnalysis: { userId } } })
  await prisma.messageAnalysis.deleteMany({ where: { userId } })

  await prisma.insightReport.deleteMany({ where: { userId } })
  await prisma.contextSnapshot.deleteMany({ where: { userId } })
  await prisma.claritySession.deleteMany({ where: { userId } })
  await prisma.storedWitness.deleteMany({ where: { userId } })
  await prisma.importJob.deleteMany({ where: { userId } })
}

import type { PrismaClient } from '@prisma/client'
import { config as loadDotenv } from 'dotenv'
import path from 'path'

loadDotenv({ path: path.resolve('.env.test'), override: true })

let instance: PrismaClient | null = null

async function getPrisma(): Promise<PrismaClient> {
  if (instance) return instance
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaNeon } = await import('@prisma/adapter-neon')
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL_OVERRIDE ?? process.env.DATABASE_URL!,
  })
  instance = new PrismaClient({ adapter })
  return instance
}

export async function setUserOnboarding(
  clerkId: string,
  opts: {
    isOnboardingComplete?: boolean
    onboardingStep?: number
    preferredName?: string
    coParentNames?: string[]
    childrenNames?: string[]
  }
): Promise<void> {
  const prisma = await getPrisma()
  await prisma.user.update({ where: { clerkId }, data: opts })
}

export async function setUserPlan(
  clerkId: string,
  plan: 'FREE' | 'STANDARD' | 'PREMIUM'
): Promise<void> {
  const prisma = await getPrisma()
  await prisma.user.update({ where: { clerkId }, data: { plan } })
}

export async function setUserTier(
  clerkId: string,
  plan: 'FREE' | 'STANDARD' | 'PREMIUM',
  overrides?: {
    subscriptionStatus?: string | null
    currentPeriodEnd?: Date | null
    cancelAtPeriodEnd?: boolean
    hasEverSubscribed?: boolean
    trialStartedAt?: Date | null
    trialEndsAt?: Date | null
    hardCutoffAt?: Date | null
  }
): Promise<void> {
  const prisma = await getPrisma()
  await prisma.user.update({ where: { clerkId }, data: { plan, ...overrides } })
}

export async function createTestCase(
  clerkId: string,
  caseTitle = 'E2E Test Case'
): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)
  const case_ = await prisma.case.create({
    data: { userId: user.id, caseTitle },
  })
  return case_.id
}

export async function deleteTestCase(caseId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.case.update({ where: { id: caseId }, data: { deletedAt: new Date() } })
}

export async function createTestCaseAccess(
  caseId: string,
  inviteEmail = 'lawyer@example.com'
): Promise<string> {
  const prisma = await getPrisma()
  const grant = await prisma.caseAccess.create({
    data: {
      caseId,
      role: 'ATTORNEY',
      status: 'ACTIVE',
      inviteEmail,
      grantedAt: new Date(),
    },
  })
  return grant.id
}

export async function deleteTestCaseAccess(accessId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.caseAccess.delete({ where: { id: accessId } })
}

export async function createTestEntry(
  clerkId: string,
  title = 'E2E Test Entry'
): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)
  const entry = await prisma.entry.create({
    data: {
      userId: user.id,
      title,
      entryDate: new Date(),
      category: 'OTHER',
      summary: 'E2E test entry for professional access testing.',
      toneEvalStatus: 'COMPLETE',
    },
  })
  return entry.id
}

export async function deleteTestEntry(entryId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.entry.update({ where: { id: entryId }, data: { deletedAt: new Date() } })
}

const SYNTHETIC_RO_CASE_TITLE = '_e2e_professional_access_'

export async function setUserReadOnly(
  clerkId: string,
  readOnly: boolean
): Promise<void> {
  const prisma = await getPrisma()
  if (!readOnly) {
    await prisma.caseAccess.deleteMany({ where: { professionalId: clerkId } })
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (user) {
      await prisma.case.deleteMany({
        where: { userId: user.id, caseTitle: SYNTHETIC_RO_CASE_TITLE },
      })
    }
    return
  }
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)
  const synthCase = await prisma.case.create({
    data: { userId: user.id, caseTitle: SYNTHETIC_RO_CASE_TITLE },
  })
  await prisma.caseAccess.create({
    data: {
      caseId: synthCase.id,
      role: 'READ_ONLY',
      status: 'ACTIVE',
      inviteEmail: `${clerkId}@professional.test`,
      professionalId: clerkId,
      grantedAt: new Date(),
    },
  })
}

/** Creates `count` recordings each with a RecordingReport for capping purposes.
 *  Returns the ID of the last recording created (for navigation). */
export async function seedRecordingsAtCap(
  clerkId: string,
  count = 5
): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)

  let lastId = ''
  for (let i = 0; i < count; i++) {
    const recording = await prisma.recording.create({
      data: {
        userId: user.id,
        storageKey: `e2e-test-recording-${i}-${Date.now()}`,
        fileUrl: `https://mock.r2.cloudflare.com/e2e-test-recording-${i}`,
        fileName: `e2e-test-${i}.m4a`,
        fileSize: 1024,
        mimeType: 'audio/mp4',
        status: 'COMPLETE',
        recordedAt: new Date(),
      },
    })
    await prisma.recordingReport.create({
      data: {
        recordingId: recording.id,
        summary: `E2E test recording report ${i}`,
        tone: 'NEUTRAL',
      },
    })
    lastId = recording.id
  }
  return lastId
}

/** Deletes all recordings (and their reports/transcripts) for a user. */
export async function cleanupUserRecordings(clerkId: string): Promise<void> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return
  const recordings = await prisma.recording.findMany({ where: { userId: user.id }, select: { id: true } })
  const ids = recordings.map((r) => r.id)
  if (!ids.length) return
  await prisma.recordingReport.deleteMany({ where: { recordingId: { in: ids } } })
  await prisma.recordingTranscript.deleteMany({ where: { recordingId: { in: ids } } })
  await prisma.recording.deleteMany({ where: { userId: user.id } })
}

/** Creates `count` MessageAnalysis records with analysisJson for capping.
 *  Returns the ID of the last record created. */
export async function seedMessageAnalysesAtCap(
  clerkId: string,
  count = 10
): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)

  let lastId = ''
  for (let i = 0; i < count; i++) {
    const analysis = await prisma.messageAnalysis.create({
      data: {
        userId: user.id,
        content: `E2E test message ${i}`,
        patternFlags: [],
        analysisJson: { tone: 'neutral', summary: `E2E test analysis ${i}` },
      },
    })
    lastId = analysis.id
  }
  return lastId
}

/** Deletes all MessageAnalysis records for a user. */
export async function cleanupUserMessageAnalyses(clerkId: string): Promise<void> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return
  await prisma.messageAnalysis.deleteMany({ where: { userId: user.id } })
}

export async function createTestInsightReport(
  clerkId: string,
  triggerType: 'SCHEDULED' | 'VELOCITY' | 'MANUAL',
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED' = 'COMPLETE'
): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)
  const now = new Date()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const report = await prisma.insightReport.create({
    data: {
      userId: user.id,
      triggerType,
      status,
      periodStart: ninetyDaysAgo,
      periodEnd: now,
      generatedAt: status === 'COMPLETE' ? now : null,
    },
  })
  return report.id
}

export async function deleteTestInsightReport(reportId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.insightReport.delete({ where: { id: reportId } })
}

export async function createTestEntryWithDate(
  clerkId: string,
  entryDate: Date,
  title = 'E2E Old Entry'
): Promise<string> {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error(`User not found for clerkId: ${clerkId}`)
  const entry = await prisma.entry.create({
    data: {
      userId: user.id,
      title,
      entryDate,
      category: 'OTHER',
      summary: 'E2E test entry with custom date.',
      toneEvalStatus: 'COMPLETE',
    },
  })
  return entry.id
}

export async function disconnectDb(): Promise<void> {
  if (instance) {
    await instance.$disconnect()
    instance = null
  }
}

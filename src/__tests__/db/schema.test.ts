/**
 * schema.test.ts — DB integration tests: factory defaults & schema invariants
 *
 * Bypasses HTTP entirely. Imports Prisma directly and asserts on the real
 * the test database. Verifies factory-produced records match schema
 * defaults, and that immutable fields (createdAt, entryHash) behave correctly
 * across updates.
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A } from '../globalSetup'
import { entryFactory, recordingFactory, messageAnalysisFactory } from '../helpers/factories'

let userId: string

beforeAll(async () => {
  const user = await prisma.user.findUnique({
    where: { clerkId: TEST_CLERK_ID_A },
    select: { id: true },
  })
  if (!user) throw new Error(`Test user not found: ${TEST_CLERK_ID_A}`)
  userId = user.id
})

const createdEntryIds: string[] = []
const createdRecordingIds: string[] = []
const createdMessageAnalysisIds: string[] = []

afterEach(async () => {
  for (const id of createdEntryIds.splice(0)) {
    await prisma.entry.deleteMany({ where: { id } })
  }
  for (const id of createdRecordingIds.splice(0)) {
    await prisma.recording.deleteMany({ where: { id } })
  }
  for (const id of createdMessageAnalysisIds.splice(0)) {
    await prisma.messageAnalysis.deleteMany({ where: { id } })
  }
})

describe('entryFactory', () => {
  it('produces a valid record with correct defaults', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    expect(entry.toneEvalStatus).toBe('PENDING')
    expect(entry.autoSplitSuggested).toBe(false)
    expect(entry.isImported).toBe(false)
    expect(entry.isDraft).toBe(false)
    expect(entry.deletedAt).toBeNull()
    expect(entry.entryHash).toBeNull()
    expect(entry.createdAt).toBeInstanceOf(Date)
  })
})

describe('recordingFactory', () => {
  it('produces a valid record with correct defaults', async () => {
    const recording = await prisma.recording.create({ data: recordingFactory(userId) })
    createdRecordingIds.push(recording.id)

    expect(recording.status).toBe('UPLOADING')
    expect(recording.deletedAt).toBeNull()
    expect(recording.sha256Hash).toBeNull()
    expect(recording.createdAt).toBeInstanceOf(Date)
  })
})

describe('messageAnalysisFactory', () => {
  it('produces a valid record with correct defaults', async () => {
    const messageAnalysis = await prisma.messageAnalysis.create({
      data: messageAnalysisFactory(userId),
    })
    createdMessageAnalysisIds.push(messageAnalysis.id)

    expect(messageAnalysis.deletedAt).toBeNull()
    expect(messageAnalysis.contentHash).toBeNull()
    expect(messageAnalysis.contextFingerprint).toBeNull()
    expect(messageAnalysis.createdAt).toBeInstanceOf(Date)
  })
})

describe('Entry immutability', () => {
  it('createdAt is never mutated by an update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)
    const originalCreatedAt = entry.createdAt

    await prisma.entry.update({
      where: { id: entry.id },
      data: { summary: 'Updated summary text for the createdAt immutability check.' },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.createdAt).toEqual(originalCreatedAt)
  })

  it('entryHash once set is not overwritten by a second update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const knownHash = 'a'.repeat(64)
    await prisma.entry.update({
      where: { id: entry.id },
      data: { entryHash: knownHash },
    })

    await prisma.entry.update({
      where: { id: entry.id },
      data: { summary: 'Second update to summary text, after entryHash was set.' },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.entryHash).toBe(knownHash)
  })
})

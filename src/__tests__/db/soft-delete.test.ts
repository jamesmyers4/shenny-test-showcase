/**
 * soft-delete.test.ts — DB integration tests: soft-delete behavior
 *
 * Per CONTEXT.md's legal defensibility principles, deletes are soft —
 * deletedAt archives the record, which is excluded from active list queries
 * but never destroyed, and soft-deleting a parent does not hard-cascade to
 * related records.
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

describe('Entry soft delete', () => {
  it('sets deletedAt', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    await prisma.entry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date() },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.deletedAt).toBeInstanceOf(Date)
  })

  it('is excluded from active list queries', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    await prisma.entry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date() },
    })

    const activeEntries = await prisma.entry.findMany({
      where: { userId, deletedAt: null },
    })

    expect(activeEntries.find((e) => e.id === entry.id)).toBeUndefined()
  })

  it('still exists in the database', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    await prisma.entry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date() },
    })

    const refetched = await prisma.entry.findUnique({ where: { id: entry.id } })
    expect(refetched).not.toBeNull()
    expect(refetched?.deletedAt).toBeInstanceOf(Date)
  })
})

describe('Recording soft delete', () => {
  it('sets deletedAt', async () => {
    const recording = await prisma.recording.create({ data: recordingFactory(userId) })
    createdRecordingIds.push(recording.id)

    await prisma.recording.update({
      where: { id: recording.id },
      data: { deletedAt: new Date() },
    })

    const refetched = await prisma.recording.findUniqueOrThrow({ where: { id: recording.id } })
    expect(refetched.deletedAt).toBeInstanceOf(Date)
  })
})

describe('MessageAnalysis soft delete', () => {
  it('sets deletedAt', async () => {
    const messageAnalysis = await prisma.messageAnalysis.create({
      data: messageAnalysisFactory(userId),
    })
    createdMessageAnalysisIds.push(messageAnalysis.id)

    await prisma.messageAnalysis.update({
      where: { id: messageAnalysis.id },
      data: { deletedAt: new Date() },
    })

    const refetched = await prisma.messageAnalysis.findUniqueOrThrow({
      where: { id: messageAnalysis.id },
    })
    expect(refetched.deletedAt).toBeInstanceOf(Date)
  })
})

describe('Soft delete cascade behavior', () => {
  it('does not cascade — related records survive', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const witness = await prisma.entryWitness.create({
      data: { entryId: entry.id, name: 'Mrs. Proulx', role: 'teacher' },
    })

    await prisma.entry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date() },
    })

    const refetchedWitness = await prisma.entryWitness.findUnique({ where: { id: witness.id } })
    expect(refetchedWitness).not.toBeNull()
  })
})

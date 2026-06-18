/**
 * ownership.test.ts — DB integration tests: Prisma-layer ownership scoping
 *
 * Tighter than the API ownership tests (src/__tests__/api/entries.test.ts) —
 * asserts directly at the ORM layer that queries scoped by userId never
 * return or mutate another user's records, independent of any route handler.
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A, TEST_CLERK_ID_B } from '../globalSetup'
import { entryFactory, recordingFactory, messageAnalysisFactory } from '../helpers/factories'

let userAId: string
let userBId: string

beforeAll(async () => {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({ where: { clerkId: TEST_CLERK_ID_A }, select: { id: true } }),
    prisma.user.findUnique({ where: { clerkId: TEST_CLERK_ID_B }, select: { id: true } }),
  ])
  if (!userA) throw new Error(`Test user not found: ${TEST_CLERK_ID_A}`)
  if (!userB) throw new Error(`Test user not found: ${TEST_CLERK_ID_B}`)
  userAId = userA.id
  userBId = userB.id
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

describe('Entry ownership', () => {
  it("User A cannot read User B's Entry", async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userBId) })
    createdEntryIds.push(entry.id)

    const result = await prisma.entry.findFirst({
      where: { id: entry.id, userId: userAId },
    })

    expect(result).toBeNull()
  })

  it("User A cannot update User B's Entry", async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userBId) })
    createdEntryIds.push(entry.id)

    const { count } = await prisma.entry.updateMany({
      where: { id: entry.id, userId: userAId },
      data: { title: 'hacked' },
    })

    expect(count).toBe(0)

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.title).toBe(entry.title)
  })

  it("User A cannot soft-delete User B's Entry", async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userBId) })
    createdEntryIds.push(entry.id)

    const { count } = await prisma.entry.updateMany({
      where: { id: entry.id, userId: userAId },
      data: { deletedAt: new Date() },
    })

    expect(count).toBe(0)

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.deletedAt).toBeNull()
  })
})

describe('Recording ownership', () => {
  it("User A cannot read User B's Recording", async () => {
    const recording = await prisma.recording.create({ data: recordingFactory(userBId) })
    createdRecordingIds.push(recording.id)

    const result = await prisma.recording.findFirst({
      where: { id: recording.id, userId: userAId },
    })

    expect(result).toBeNull()
  })
})

describe('MessageAnalysis ownership', () => {
  it("User A cannot read User B's MessageAnalysis", async () => {
    const messageAnalysis = await prisma.messageAnalysis.create({
      data: messageAnalysisFactory(userBId),
    })
    createdMessageAnalysisIds.push(messageAnalysis.id)

    const result = await prisma.messageAnalysis.findFirst({
      where: { id: messageAnalysis.id, userId: userAId },
    })

    expect(result).toBeNull()
  })
})

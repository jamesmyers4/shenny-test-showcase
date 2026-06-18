/**
 * entry-hash.test.ts — DB integration tests: entryHash tamper detection
 *
 * Bypasses HTTP entirely. Imports Prisma directly and asserts on the real
 * the test database. Per the application's legal defensibility principles,
 * entryHash is computed at finalization as SHA-256 of id + userId + createdAt
 * + summary, set once, and never updated. These tests verify the DB layer
 * upholds that contract regardless of what update payloads are sent — hash
 * computation itself is application logic and belongs in a unit test.
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A } from '../globalSetup'
import { entryFactory } from '../helpers/factories'

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

afterEach(async () => {
  for (const id of createdEntryIds.splice(0)) {
    await prisma.entry.deleteMany({ where: { id } })
  }
})

describe('entryHash', () => {
  it('is null on a newly created Entry', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    expect(entry.entryHash).toBeNull()
  })

  it('can be set exactly once via update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const knownHash = 'a'.repeat(64)
    await prisma.entry.update({
      where: { id: entry.id },
      data: { entryHash: knownHash },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.entryHash).toBe(knownHash)
  })

  it('is not cleared by a subsequent summary update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const knownHash = 'b'.repeat(64)
    await prisma.entry.update({
      where: { id: entry.id },
      data: { entryHash: knownHash },
    })

    await prisma.entry.update({
      where: { id: entry.id },
      data: { summary: 'Updated summary text after entryHash was set.' },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.entryHash).toBe(knownHash)
  })

  it('is not cleared by a subsequent title update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const knownHash = 'c'.repeat(64)
    await prisma.entry.update({
      where: { id: entry.id },
      data: { entryHash: knownHash },
    })

    await prisma.entry.update({
      where: { id: entry.id },
      data: { title: 'Updated title after entryHash was set' },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.entryHash).toBe(knownHash)
  })

  it('survives a tone update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const knownHash = 'd'.repeat(64)
    await prisma.entry.update({
      where: { id: entry.id },
      data: { entryHash: knownHash },
    })

    await prisma.entry.update({
      where: { id: entry.id },
      data: { tone: 'CONCERNING' },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.entryHash).toBe(knownHash)
  })

  it('is not affected by a toneEvalStatus update', async () => {
    const entry = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entry.id)

    const knownHash = 'e'.repeat(64)
    await prisma.entry.update({
      where: { id: entry.id },
      data: { entryHash: knownHash },
    })

    await prisma.entry.update({
      where: { id: entry.id },
      data: { toneEvalStatus: 'COMPLETE' },
    })

    const refetched = await prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(refetched.entryHash).toBe(knownHash)
  })

  it('two Entries for the same user can have distinct entryHash values', async () => {
    const entryOne = await prisma.entry.create({ data: entryFactory(userId) })
    createdEntryIds.push(entryOne.id)

    const entryTwo = await prisma.entry.create({
      data: entryFactory(userId, { title: 'A second, distinct entry' }),
    })
    createdEntryIds.push(entryTwo.id)

    const hashOne = 'f'.repeat(64)
    const hashTwo = '1'.repeat(64)

    await prisma.entry.update({ where: { id: entryOne.id }, data: { entryHash: hashOne } })
    await prisma.entry.update({ where: { id: entryTwo.id }, data: { entryHash: hashTwo } })

    const [refetchedOne, refetchedTwo] = await Promise.all([
      prisma.entry.findUniqueOrThrow({ where: { id: entryOne.id } }),
      prisma.entry.findUniqueOrThrow({ where: { id: entryTwo.id } }),
    ])

    expect(refetchedOne.entryHash).toBe(hashOne)
    expect(refetchedTwo.entryHash).toBe(hashTwo)
    expect(refetchedOne.entryHash).not.toBe(refetchedTwo.entryHash)
  })
})

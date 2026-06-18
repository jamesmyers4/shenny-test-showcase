/**
 * cap-boost.test.ts — DB integration tests: CapBoost model contracts
 *
 * Bypasses HTTP entirely. Imports Prisma directly and asserts on the real
 * the test database. CapBoost stores per-feature, per-period cap
 * top-ups (ADR-021); the aggregate math is covered in ai-call-log.test.ts.
 * This file covers the model's structural contracts: field storage, cascade
 * delete on user removal, and period/feature isolation.
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A } from '../globalSetup'
import { userFactory } from '../helpers/factories'

let userAId: string

beforeAll(async () => {
  const userA = await prisma.user.findUnique({
    where: { clerkId: TEST_CLERK_ID_A },
    select: { id: true },
  })
  if (!userA) throw new Error(`Test user not found: ${TEST_CLERK_ID_A}`)
  userAId = userA.id
})

const createdCapBoostIds: string[] = []
const createdUserIds: string[] = []

afterEach(async () => {
  for (const id of createdCapBoostIds.splice(0)) {
    await prisma.capBoost.deleteMany({ where: { id } })
  }
  for (const id of createdUserIds.splice(0)) {
    await prisma.user.deleteMany({ where: { id } })
  }
})

describe('CapBoost', () => {
  it('stores all fields correctly', async () => {
    const boost = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-08', additionalCap: 50 },
    })
    createdCapBoostIds.push(boost.id)

    const refetched = await prisma.capBoost.findUniqueOrThrow({ where: { id: boost.id } })

    expect(refetched.userId).toBe(userAId)
    expect(refetched.feature).toBe('clarity')
    expect(refetched.periodKey).toBe('2026-08')
    expect(refetched.additionalCap).toBe(50)
    expect(refetched.createdAt).toBeInstanceOf(Date)
  })

  it('is cascade-deleted when the user is deleted', async () => {
    const user = await prisma.user.create({
      data: userFactory(`test_clerk_capboost_cascade_${Date.now()}`),
    })
    createdUserIds.push(user.id)

    await prisma.capBoost.create({
      data: { userId: user.id, feature: 'clarity', periodKey: '2026-08', additionalCap: 25 },
    })

    await prisma.user.delete({ where: { id: user.id } })

    const remaining = await prisma.capBoost.findMany({ where: { userId: user.id } })
    expect(remaining).toHaveLength(0)
  })

  it('multiple rows can exist for the same user and feature across different periods', async () => {
    const boostMay = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-05', additionalCap: 10 },
    })
    createdCapBoostIds.push(boostMay.id)

    const boostAugust = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-08', additionalCap: 20 },
    })
    createdCapBoostIds.push(boostAugust.id)

    const [refetchedMay, refetchedAugust] = await Promise.all([
      prisma.capBoost.findUniqueOrThrow({ where: { id: boostMay.id } }),
      prisma.capBoost.findUniqueOrThrow({ where: { id: boostAugust.id } }),
    ])

    expect(refetchedMay.periodKey).toBe('2026-05')
    expect(refetchedAugust.periodKey).toBe('2026-08')
  })

  it('rows for different features are independent', async () => {
    const clarityBoost = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-08', additionalCap: 10 },
    })
    createdCapBoostIds.push(clarityBoost.id)

    const messageAnalysisBoost = await prisma.capBoost.create({
      data: {
        userId: userAId,
        feature: 'messageAnalysis',
        periodKey: '2026-08',
        additionalCap: 20,
      },
    })
    createdCapBoostIds.push(messageAnalysisBoost.id)

    const results = await prisma.capBoost.findMany({
      where: { userId: userAId, feature: 'clarity', periodKey: '2026-08' },
    })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(clarityBoost.id)
  })

  it('additionalCap of 0 is stored at the DB level', async () => {
    const boost = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-08', additionalCap: 0 },
    })
    createdCapBoostIds.push(boost.id)

    const refetched = await prisma.capBoost.findUniqueOrThrow({ where: { id: boost.id } })
    expect(refetched.additionalCap).toBe(0)
  })
})

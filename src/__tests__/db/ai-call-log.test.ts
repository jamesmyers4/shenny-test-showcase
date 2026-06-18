/**
 * ai-call-log.test.ts — DB integration tests: AiCallLog & CapBoost
 *
 * Bypasses HTTP entirely. Imports Prisma directly and asserts on the real
 * the test database. AiCallLog is the source of truth for usage cap
 * counting (ADR-021) — if a pipeline stops writing rows, caps silently stop
 * enforcing. CapBoost stores per-feature, per-period cap top-ups; the
 * effective cap is the tier base cap plus the sum of additionalCap across a
 * user's CapBoost rows for the current periodKey.
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A, TEST_CLERK_ID_B } from '../globalSetup'

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

const createdAiCallLogIds: string[] = []
const createdCapBoostIds: string[] = []

afterEach(async () => {
  for (const id of createdAiCallLogIds.splice(0)) {
    await prisma.aiCallLog.deleteMany({ where: { id } })
  }
  for (const id of createdCapBoostIds.splice(0)) {
    await prisma.capBoost.deleteMany({ where: { id } })
  }
})

describe('AiCallLog', () => {
  it('is written with correct fields', async () => {
    const log = await prisma.aiCallLog.create({
      data: {
        pipeline: 'messageAnalysis',
        userId: userAId,
        model: 'claude-sonnet-4-6',
        promptTokens: 1200,
        completionTokens: 450,
        cachedTokens: 300,
        latencyMs: 2100,
        costUsd: 0.0123,
        success: true,
      },
    })
    createdAiCallLogIds.push(log.id)

    expect(log.pipeline).toBe('messageAnalysis')
    expect(log.userId).toBe(userAId)
    expect(log.model).toBe('claude-sonnet-4-6')
    expect(log.promptTokens).toBe(1200)
    expect(log.completionTokens).toBe(450)
    expect(log.cachedTokens).toBe(300)
    expect(log.latencyMs).toBe(2100)
    expect(log.costUsd).toBe(0.0123)
    expect(log.success).toBe(true)
    expect(log.createdAt).toBeInstanceOf(Date)
  })

  it('success defaults to true', async () => {
    const log = await prisma.aiCallLog.create({
      data: {
        pipeline: 'clarity',
        userId: userAId,
        model: 'claude-sonnet-4-6',
        promptTokens: 800,
        completionTokens: 200,
        latencyMs: 1500,
        costUsd: 0.005,
      },
    })
    createdAiCallLogIds.push(log.id)

    expect(log.success).toBe(true)
  })

  it('cachedTokens defaults to 0', async () => {
    const log = await prisma.aiCallLog.create({
      data: {
        pipeline: 'recordingReport',
        userId: userAId,
        model: 'claude-sonnet-4-6',
        promptTokens: 900,
        completionTokens: 300,
        latencyMs: 1800,
        costUsd: 0.006,
      },
    })
    createdAiCallLogIds.push(log.id)

    expect(log.cachedTokens).toBe(0)
  })

  it('stores errorMessage for a failed pipeline call', async () => {
    const log = await prisma.aiCallLog.create({
      data: {
        pipeline: 'insightReport',
        userId: userAId,
        model: 'claude-opus-4-8',
        promptTokens: 500,
        completionTokens: 0,
        latencyMs: 30000,
        costUsd: 0.0025,
        success: false,
        errorMessage: 'timeout',
      },
    })
    createdAiCallLogIds.push(log.id)

    expect(log.success).toBe(false)
    expect(log.errorMessage).toBe('timeout')
  })

  it('rows are queryable by userId and pipeline', async () => {
    const logA1 = await prisma.aiCallLog.create({
      data: {
        pipeline: 'messageAnalysis',
        userId: userAId,
        model: 'claude-sonnet-4-6',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 1000,
        costUsd: 0.001,
      },
    })
    createdAiCallLogIds.push(logA1.id)

    const logA2 = await prisma.aiCallLog.create({
      data: {
        pipeline: 'recordingReport',
        userId: userAId,
        model: 'claude-sonnet-4-6',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 1000,
        costUsd: 0.001,
      },
    })
    createdAiCallLogIds.push(logA2.id)

    const logB = await prisma.aiCallLog.create({
      data: {
        pipeline: 'messageAnalysis',
        userId: userBId,
        model: 'claude-sonnet-4-6',
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 1000,
        costUsd: 0.001,
      },
    })
    createdAiCallLogIds.push(logB.id)

    const results = await prisma.aiCallLog.findMany({
      where: { userId: userAId, pipeline: 'messageAnalysis' },
    })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(logA1.id)
  })
})

describe('CapBoost', () => {
  it('additionalCap is summed correctly for a period', async () => {
    const boost1 = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-06', additionalCap: 10 },
    })
    createdCapBoostIds.push(boost1.id)

    const boost2 = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-06', additionalCap: 15 },
    })
    createdCapBoostIds.push(boost2.id)

    const result = await prisma.capBoost.aggregate({
      _sum: { additionalCap: true },
      where: { userId: userAId, feature: 'clarity', periodKey: '2026-06' },
    })

    expect(result._sum.additionalCap).toBe(25)
  })

  it('rows from a different periodKey do not contribute to the sum', async () => {
    const boost1 = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-06', additionalCap: 10 },
    })
    createdCapBoostIds.push(boost1.id)

    const boost2 = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-05', additionalCap: 20 },
    })
    createdCapBoostIds.push(boost2.id)

    const result = await prisma.capBoost.aggregate({
      _sum: { additionalCap: true },
      where: { userId: userAId, feature: 'clarity', periodKey: '2026-06' },
    })

    expect(result._sum.additionalCap).toBe(10)
  })

  it('rows from a different feature do not contribute to the sum', async () => {
    const boost1 = await prisma.capBoost.create({
      data: { userId: userAId, feature: 'clarity', periodKey: '2026-06', additionalCap: 10 },
    })
    createdCapBoostIds.push(boost1.id)

    const boost2 = await prisma.capBoost.create({
      data: {
        userId: userAId,
        feature: 'messageAnalysis',
        periodKey: '2026-06',
        additionalCap: 20,
      },
    })
    createdCapBoostIds.push(boost2.id)

    const result = await prisma.capBoost.aggregate({
      _sum: { additionalCap: true },
      where: { userId: userAId, feature: 'clarity', periodKey: '2026-06' },
    })

    expect(result._sum.additionalCap).toBe(10)
  })
})

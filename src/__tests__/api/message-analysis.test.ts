/**
 * message-analysis.test.ts — MessageAnalysis contract tests
 *
 * Tests both the CRUD surface (/api/message-analysis) and the AI analysis
 * endpoint with caching (/api/message-analysis/analyze).
 *
 * Claude calls are prevented by MOCK_AI=true (runAiPrompt returns fixture JSON)
 * AND by mocking @/lib/ai so we can spy on analyzeMessage call counts.
 */

import { vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

const mockAnalyzeMessage = vi.fn()
const mockAnalyzeBiff = vi.fn()

vi.mock('@/lib/ai', () => ({
  analyzeMessage: mockAnalyzeMessage,
  analyzeBiff: mockAnalyzeBiff,
  runAiPrompt: vi.fn(),
  synthesizePassResults: vi.fn(),
}))

import { createHash } from 'crypto'
import { api } from '../helpers/client'
import { setAuthUser, clearAuth, TEST_CLERK_ID_A, TEST_CLERK_ID_B } from '../helpers/auth'
import { prisma } from '@/lib/prisma'
import { MOCK_ANALYSIS_RESULT, MOCK_BIFF_RESULT } from '../mocks/anthropic'

const ANALYSIS_CONTENT = 'Please confirm the schedule for next weekend drop-off.'

const createdIds: string[] = []

beforeEach(() => {
  mockAnalyzeMessage.mockResolvedValue(MOCK_ANALYSIS_RESULT)
  mockAnalyzeBiff.mockResolvedValue(MOCK_BIFF_RESULT)
})

afterEach(async () => {
  for (const id of createdIds) {
    try {
      await prisma.auditLog.deleteMany({ where: { recordId: id } })
      await prisma.messageAnalysis.deleteMany({ where: { id } })
    } catch {
      // already cleaned
    }
  }
  createdIds.length = 0
  vi.clearAllMocks()
  // Reset tier — running an analysis now requires a paid tier (ADR-021 REVISED:
  // message analysis is locked at FREE). Keep user A permanent-FREE between tests.
  await prisma.user.update({
    where: { clerkId: TEST_CLERK_ID_A },
    data: { plan: 'FREE', subscriptionStatus: null },
  })
})

// ─── POST /api/message-analysis ─────────────────────────────────────────────

describe('POST /api/message-analysis', () => {
  it('creates an analysis for authenticated user (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api()
      .post('/api/message-analysis')
      .send({ content: ANALYSIS_CONTENT })
    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('analysis')
    createdIds.push(res.body.data.analysis.id)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api()
      .post('/api/message-analysis')
      .send({ content: ANALYSIS_CONTENT })
    expect(res.status).toBe(401)
  })

  it('returns 400 when content is missing', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/message-analysis').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when content is empty string', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/message-analysis').send({ content: '' })
    expect(res.status).toBe(400)
  })
})

// ─── GET /api/message-analysis ──────────────────────────────────────────────

describe('GET /api/message-analysis', () => {
  it('returns analyses for authenticated user (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    // Create one first
    const created = await api()
      .post('/api/message-analysis')
      .send({ content: ANALYSIS_CONTENT })
    createdIds.push(created.body.data.analysis.id)

    const res = await api().get('/api/message-analysis')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('analyses')
    expect(Array.isArray(res.body.data.analyses)).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().get('/api/message-analysis')
    expect(res.status).toBe(401)
  })
})

// ─── GET /api/message-analysis/:id ──────────────────────────────────────────

describe('GET /api/message-analysis/:id', () => {
  it('returns a single analysis for its owner (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api()
      .post('/api/message-analysis')
      .send({ content: ANALYSIS_CONTENT })
    createdIds.push(created.body.data.analysis.id)

    const res = await api().get(`/api/message-analysis/${created.body.data.analysis.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(created.body.data.analysis.id)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().get('/api/message-analysis/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for nonexistent id', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/message-analysis/does-not-exist-999')
    expect(res.status).toBe(404)
  })
})

// ─── POST /api/message-analysis/analyze — cache hit test ────────────────────

describe('POST /api/message-analysis/analyze — caching', () => {
  const CACHE_CONTENT = 'Cache test: please confirm the weekend handover location.'

  it('cache miss: calls analyzeMessage on a fresh submission', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    // Running an analysis requires a paid tier (FREE is locked). Use STANDARD.
    await prisma.user.update({
      where: { clerkId: TEST_CLERK_ID_A },
      data: { plan: 'STANDARD', subscriptionStatus: 'active' },
    })
    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: CACHE_CONTENT, save: true, passes: 1 })
    expect(res.status).toBe(200)
    expect(res.body.data.fromCache).toBeFalsy()
    expect(mockAnalyzeMessage).toHaveBeenCalledTimes(1)

    // Clean up — find the saved analysis
    const contentHash = createHash('sha256').update(CACHE_CONTENT).digest('hex')
    const userA = await prisma.user.findUnique({
      where: { clerkId: TEST_CLERK_ID_A },
      select: { id: true },
    })
    if (userA) {
      const saved = await prisma.messageAnalysis.findFirst({
        where: { userId: userA.id, contentHash },
      })
      if (saved) createdIds.push(saved.id)
    }
  })

  it('cache hit: second identical submission returns fromCache:true, analyzeMessage called once total', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const content = 'Cache hit test: schedule the Wednesday handoff at school.'
    const contentHash = createHash('sha256').update(content).digest('hex')

    const userA = await prisma.user.findUnique({
      where: { clerkId: TEST_CLERK_ID_A },
      select: { id: true },
    })
    if (!userA) throw new Error('Test user A not found')

    // Wipe all analyses for user A so the fingerprint computation is deterministic.
    // Stale records from prior test runs would shift getContextFingerprint's output,
    // causing the fingerprint we compute here to differ from what the route computes.
    await prisma.auditLog.deleteMany({ where: { userId: userA.id } })
    await prisma.messageAnalysis.deleteMany({ where: { userId: userA.id } })

    // Seed a cached analysis directly in DB.
    const seeded = await prisma.messageAnalysis.create({
      data: {
        userId: userA.id,
        content,
        contentHash,
        contextFingerprint: 'placeholder',
        analysisJson: MOCK_ANALYSIS_RESULT as object,
        patternFlags: [],
      },
    })
    createdIds.push(seeded.id)

    // After seeding, with no entries or recordings for this user, the route's
    // getContextFingerprint = SHA256(seeded.updatedAt.toISOString()).
    // Update contextFingerprint via raw SQL (bypasses Prisma @updatedAt) to match.
    const expectedFingerprint = createHash('sha256')
      .update(seeded.updatedAt.toISOString())
      .digest('hex')

    await prisma.$executeRawUnsafe(
      `UPDATE "MessageAnalysis" SET "contextFingerprint" = $1 WHERE id = $2`,
      expectedFingerprint,
      seeded.id
    )

    // Now issue the analyze request — should hit the cache
    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content, save: false, passes: 1 })
    expect(res.status).toBe(200)
    expect(res.body.data.fromCache).toBe(true)
    // analyzeMessage must NOT have been called (cache hit)
    expect(mockAnalyzeMessage).not.toHaveBeenCalled()
  })
})

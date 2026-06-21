/**
 * rate-limit.test.ts — session-keyed burst throttle on the AI routes (Session 3).
 *
 * The per-period usage caps (ADR-021) bound monthly volume; this throttle bounds
 * per-minute BURST in front of them. It is keyed by userId (not IP) and sits
 * before checkFeatureCap on the user-facing AI routes.
 *
 * The Upstash client is fully MOCKED here — no real Redis is contacted:
 *   - @upstash/ratelimit  → fake Ratelimit whose .limit() returns mockLimit
 *   - @upstash/redis      → fake Redis constructor
 * UPSTASH_* env vars are set in beforeAll so the wrapper takes the "configured"
 * path (it fails OPEN when they are absent), and removed in afterAll so the rest
 * of the suite — which shares this worker's process.env — stays fail-open.
 *
 * The AI layer is mocked (MOCK_ANALYSIS_RESULT) so the success path makes no
 * Claude call. Prisma hits the real test DB, same as the other API tests.
 */

import { vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

const mockAnalyzeMessage = vi.fn()
vi.mock('@/lib/ai', () => ({
  analyzeMessage: mockAnalyzeMessage,
  analyzeBiff: vi.fn(),
  runAiPrompt: vi.fn(),
  synthesizePassResults: vi.fn(),
}))

// Mock the Upstash client so the wrapper exercises its real logic without Redis.
// Regular `function`s (not arrows) are required for the mock implementations:
// @/lib/ratelimit constructs both via `new Ratelimit(...)` / `new Redis(...)`.
const mockLimit = vi.fn()
vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(function () {
    return { limit: mockLimit }
  })
  ;(Ratelimit as unknown as { slidingWindow: () => unknown }).slidingWindow = vi.fn(
    () => ({})
  )
  return { Ratelimit }
})
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function () {
    return {}
  }),
}))

import { api } from '../helpers/client'
import { setAuthUser, TEST_CLERK_ID_A } from '../helpers/auth'
import { prisma } from '@/lib/prisma'
import { MOCK_ANALYSIS_RESULT } from '../mocks/anthropic'
import { checkRateLimit } from '@/lib/ratelimit'
import { generateInsightReport } from '@/lib/ai/insightReport'

const ALLOW = { success: true, limit: 5, remaining: 4, reset: Date.now() + 60_000 }
const DENY = { success: false, limit: 5, remaining: 0, reset: Date.now() + 30_000 }

let savedUrl: string | undefined
let savedToken: string | undefined

async function getUserAId(): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { clerkId: TEST_CLERK_ID_A },
    select: { id: true },
  })
  if (!u) throw new Error('Test user A not found')
  return u.id
}

async function setStandardActive(): Promise<void> {
  await prisma.user.update({
    where: { clerkId: TEST_CLERK_ID_A },
    data: { plan: 'STANDARD', subscriptionStatus: 'active' },
  })
}

async function resetUser(): Promise<void> {
  await prisma.user.update({
    where: { clerkId: TEST_CLERK_ID_A },
    data: { plan: 'FREE', subscriptionStatus: null },
  })
}

beforeAll(() => {
  // Snapshot + set Upstash env so the wrapper takes the "configured" path.
  savedUrl = process.env.UPSTASH_REDIS_REST_URL
  savedToken = process.env.UPSTASH_REDIS_REST_TOKEN
  process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'
})

afterAll(async () => {
  // Restore env so the remaining test files (shared worker) stay fail-open.
  if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
  else process.env.UPSTASH_REDIS_REST_URL = savedUrl
  if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
  else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken
  await resetUser()
})

beforeEach(() => {
  mockAnalyzeMessage.mockResolvedValue(MOCK_ANALYSIS_RESULT)
  mockLimit.mockResolvedValue(ALLOW)
})

afterEach(async () => {
  vi.clearAllMocks()
  await resetUser()
})

// ── Wrapper-level fail-open behaviour ────────────────────────────────────────

describe('checkRateLimit — fail-open when Upstash is unconfigured', () => {
  it('allows (success:true) and makes no Upstash call when env vars are absent', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    try {
      const res = await checkRateLimit(await getUserAId(), 'messageAnalysis')
      expect(res.success).toBe(true)
      expect(mockLimit).not.toHaveBeenCalled()
    } finally {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'
    }
  })
})

// ── 429 enforcement on the user-facing AI routes ─────────────────────────────

describe('POST /api/message-analysis/analyze — burst throttle', () => {
  it('returns 429 rate_limited when the limiter denies, before the AI call', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setStandardActive() // a paid tier, so the cap would otherwise allow
    mockLimit.mockResolvedValue(DENY)

    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `burst-${Date.now()}`, save: false, passes: 1 })

    expect(res.status).toBe(429)
    expect(res.body.error).toBe('rate_limited')
    expect(res.body.feature).toBe('messageAnalysis')
    // The structured body carries the retry hint (web+mobile read this; the
    // route also sets a Retry-After header, which the test harness does not
    // forward — only content-type is proxied in server.ts).
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0)
    expect(mockAnalyzeMessage).not.toHaveBeenCalled()
  })

  it('proceeds (200) and calls the AI when the limiter allows', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setStandardActive()
    mockLimit.mockResolvedValue(ALLOW)

    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `allowed-${Date.now()}`, save: false, passes: 1 })

    expect(res.status).toBe(200)
    expect(mockAnalyzeMessage).toHaveBeenCalledTimes(1)
  })

  it('keys the throttle by the userId (the session), not by IP', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setStandardActive()
    mockLimit.mockResolvedValue(DENY)
    const userId = await getUserAId()

    await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `key-${Date.now()}`, save: false, passes: 1 })

    expect(mockLimit).toHaveBeenCalledWith(userId)
  })
})

// ── Throttle on the cron-internal insight generator: defer, never 429 ────────

describe('generateInsightReport — burst throttle defers (no Opus call)', () => {
  it('returns without creating a report when the limiter denies', async () => {
    const userId = await getUserAId()
    mockLimit.mockResolvedValue(DENY)
    // Seed one finalized entry so the no-data guard passes and execution reaches
    // the throttle (which sits just before the Opus call). The insight generator
    // has no MOCK_AI bypass, so a deny is the only way to assert it never calls
    // Anthropic — the throttle must short-circuit first.
    const entry = await prisma.entry.create({
      data: {
        userId,
        entryDate: new Date(),
        title: 'rl insight seed',
        category: 'INCIDENT',
        summary: 'seed entry for insight throttle test',
      },
    })
    try {
      await generateInsightReport(userId, 'MANUAL')
      const reports = await prisma.insightReport.count({ where: { userId } })
      expect(reports).toBe(0) // deferred — nothing created, no Opus call made
      expect(mockLimit).toHaveBeenCalledWith(userId)
    } finally {
      await prisma.insightReport.deleteMany({ where: { userId } })
      await prisma.entry.delete({ where: { id: entry.id } })
    }
  })
})

describe('POST /api/clarity/sessions/[id]/messages — burst throttle', () => {
  it('returns 429 rate_limited before opening the stream when denied', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setStandardActive()
    mockLimit.mockResolvedValue(DENY)
    const userId = await getUserAId()
    const session = await prisma.claritySession.create({
      data: { userId, title: 'rl test' },
    })
    try {
      const res = await api()
        .post(`/api/clarity/sessions/${session.id}/messages`)
        .send({ content: 'hello' })

      expect(res.status).toBe(429)
      expect(res.body.error).toBe('rate_limited')
      expect(res.body.feature).toBe('clarity')
      // No assistant message persisted — gated before the stream.
      const count = await prisma.clarityMessage.count({ where: { sessionId: session.id } })
      expect(count).toBe(0)
    } finally {
      await prisma.clarityMessage.deleteMany({ where: { sessionId: session.id } })
      await prisma.claritySession.delete({ where: { id: session.id } })
    }
  })
})

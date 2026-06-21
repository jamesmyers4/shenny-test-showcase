/**
 * usage-caps.test.ts — usage-cap + tier-lock model (ADR-021 REVISED 2026-06-04)
 *
 * The corrected model:
 *   - FREE is journal + own-export + ToneEval only. The four metered AI features
 *     are LOCKED at FREE (cap 0) — a route returns a tier_required body BEFORE
 *     counting any usage. Setting FREE caps to 0 is necessary; the explicit
 *     tier_required lock is what makes it legible and tamper-resistant.
 *   - TRIAL is an opt-in sample-cap tier (active over trialStartedAt/trialEndsAt).
 *   - STANDARD/PREMIUM draw their own caps; at cap → usage_cap_reached.
 *   - A lapsed paid subscriber (or lapsed trial) falls back to FREE: locked out
 *     of metered AI but never read-only — their own records stay readable.
 *
 * The AI layer is mocked (MOCK_ANALYSIS_RESULT) so no Claude calls are made.
 * Prisma hits the real test DB, same as the other API tests.
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

import { api } from '../helpers/client'
import { setAuthUser, TEST_CLERK_ID_A } from '../helpers/auth'
import { prisma } from '@/lib/prisma'
import { MOCK_ANALYSIS_RESULT, MOCK_BIFF_RESULT } from '../mocks/anthropic'
import {
  getAccessTier,
  isTrialActive,
  isFeatureLocked,
  checkFeatureCap,
  TIER_CAPS,
  CAPPED_FEATURES,
  type CappedFeature,
  applyTopUp,
  getFeatureUsage,
  getCurrentPeriodStart,
} from '@/lib/access'

const DAY = 24 * 60 * 60 * 1000

async function getUserAId(): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { clerkId: TEST_CLERK_ID_A },
    select: { id: true },
  })
  if (!u) throw new Error('Test user A not found')
  return u.id
}

/** Put test user A into a specific tier/trial state. */
async function setUserState(data: {
  plan?: 'FREE' | 'STANDARD' | 'PREMIUM'
  subscriptionStatus?: string | null
  trialStartedAt?: Date | null
  trialEndsAt?: Date | null
}): Promise<void> {
  await prisma.user.update({ where: { clerkId: TEST_CLERK_ID_A }, data })
}

/** Reset user A back to a plain permanent-FREE user. */
async function resetUserState(): Promise<void> {
  await setUserState({
    plan: 'FREE',
    subscriptionStatus: null,
    trialStartedAt: null,
    trialEndsAt: null,
  })
}

/** Seed `n` saved MessageAnalysis rows in the current period for user A. */
async function seedAnalyses(userId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await prisma.messageAnalysis.create({
      data: {
        userId,
        content: `seed-${Date.now()}-${i}`,
        analysisJson: MOCK_ANALYSIS_RESULT as object,
        patternFlags: [],
      },
    })
  }
}

async function wipeUserAUsage(userId: string): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { userId } })
  await prisma.messageAnalysis.deleteMany({ where: { userId } })
  await prisma.capBoost.deleteMany({ where: { userId } })
}

beforeEach(() => {
  mockAnalyzeMessage.mockResolvedValue(MOCK_ANALYSIS_RESULT)
  mockAnalyzeBiff.mockResolvedValue(MOCK_BIFF_RESULT)
})

afterEach(async () => {
  vi.clearAllMocks()
  const userId = await getUserAId()
  await wipeUserAUsage(userId)
  await resetUserState()
})

// ── getAccessTier: paid → trial → FREE, with permanent FREE floor ────────────

describe('getAccessTier — tier + trial resolution', () => {
  it('active PREMIUM subscriber is PREMIUM', () => {
    expect(getAccessTier({ plan: 'PREMIUM', subscriptionStatus: 'active' })).toBe('PREMIUM')
  })

  it('active STANDARD subscriber is STANDARD', () => {
    expect(getAccessTier({ plan: 'STANDARD', subscriptionStatus: 'active' })).toBe('STANDARD')
  })

  it('lapsed (canceled) PREMIUM falls back to FREE, not a read-only state', () => {
    expect(getAccessTier({ plan: 'PREMIUM', subscriptionStatus: 'canceled' })).toBe('FREE')
  })

  it('past_due paid subscriber falls back to FREE', () => {
    expect(getAccessTier({ plan: 'STANDARD', subscriptionStatus: 'past_due' })).toBe('FREE')
  })

  it('plain FREE user is FREE', () => {
    expect(getAccessTier({ plan: 'FREE', subscriptionStatus: null })).toBe('FREE')
  })

  it('an active trial window resolves to TRIAL', () => {
    expect(
      getAccessTier({
        plan: 'FREE',
        subscriptionStatus: null,
        trialStartedAt: new Date(Date.now() - DAY),
        trialEndsAt: new Date(Date.now() + DAY),
      })
    ).toBe('TRIAL')
  })

  it('an expired trial falls back to FREE (locked, never read-only)', () => {
    expect(
      getAccessTier({
        plan: 'FREE',
        subscriptionStatus: null,
        trialStartedAt: new Date(Date.now() - 10 * DAY),
        trialEndsAt: new Date(Date.now() - DAY),
      })
    ).toBe('FREE')
  })

  it('a never-started trial is FREE', () => {
    expect(
      getAccessTier({ plan: 'FREE', subscriptionStatus: null, trialStartedAt: null, trialEndsAt: null })
    ).toBe('FREE')
  })

  it('an active paid subscription takes precedence over a trial window', () => {
    expect(
      getAccessTier({
        plan: 'STANDARD',
        subscriptionStatus: 'active',
        trialStartedAt: new Date(Date.now() - DAY),
        trialEndsAt: new Date(Date.now() + DAY),
      })
    ).toBe('STANDARD')
  })

  it('isTrialActive refuses BEFORE any amount: inactive window is false', () => {
    expect(isTrialActive({ trialStartedAt: null, trialEndsAt: null })).toBe(false)
    expect(
      isTrialActive({ trialStartedAt: new Date(Date.now() - 2 * DAY), trialEndsAt: new Date(Date.now() - DAY) })
    ).toBe(false)
  })
})

// ── Cap config shape: FREE locked at 0; sample/paid caps per the ADR table ────

describe('TIER_CAPS — corrected shape', () => {
  it('FREE is 0 (locked) for every metered feature', () => {
    for (const f of CAPPED_FEATURES) {
      expect(TIER_CAPS.FREE[f]).toBe(0)
      expect(isFeatureLocked('FREE', f)).toBe(true)
    }
  })

  it('TRIAL/STANDARD/PREMIUM are unlocked (nonzero) for every metered feature', () => {
    for (const tier of ['TRIAL', 'STANDARD', 'PREMIUM'] as const) {
      for (const f of CAPPED_FEATURES) {
        expect(TIER_CAPS[tier][f]).toBeGreaterThan(0)
        expect(isFeatureLocked(tier, f)).toBe(false)
      }
    }
  })

  it('matches the ADR-021 starting cap table', () => {
    expect(TIER_CAPS.TRIAL).toEqual({ messageAnalysis: 3, recordingReport: 2, insightReport: 1, clarity: 15 })
    expect(TIER_CAPS.STANDARD).toEqual({ messageAnalysis: 25, recordingReport: 15, insightReport: 1, clarity: 200 })
    expect(TIER_CAPS.PREMIUM).toEqual({ messageAnalysis: 150, recordingReport: 60, insightReport: 3, clarity: 1000 })
  })

  it('tone is never a capped feature', () => {
    expect(CAPPED_FEATURES).not.toContain('tone' as CappedFeature)
    expect(CAPPED_FEATURES).toEqual(['recordingReport', 'messageAnalysis', 'insightReport', 'clarity'])
  })
})

// ── Gate precedence at the helper: FREE locks all four BEFORE counting ────────

describe('checkFeatureCap — precedence', () => {
  it('FREE returns a tier_required lock (NOT a usage count) for all four features', async () => {
    const userId = await getUserAId()
    for (const f of CAPPED_FEATURES) {
      const gate = await checkFeatureCap(userId, 'FREE', f)
      expect(gate.allowed).toBe(false)
      expect(gate.body?.error).toBe('tier_required')
      expect(gate.body?.error).not.toBe('usage_cap_reached')
      expect(gate.usage.tierLocked).toBe(true)
    }
  })

  it('TRIAL under its sample cap is allowed', async () => {
    const userId = await getUserAId()
    const gate = await checkFeatureCap(userId, 'TRIAL', 'messageAnalysis')
    expect(gate.allowed).toBe(true)
    expect(gate.body).toBeNull()
  })

  it('TRIAL at its sample cap returns usage_cap_reached (not tier_required)', async () => {
    const userId = await getUserAId()
    await seedAnalyses(userId, TIER_CAPS.TRIAL.messageAnalysis)
    const gate = await checkFeatureCap(userId, 'TRIAL', 'messageAnalysis')
    expect(gate.allowed).toBe(false)
    expect(gate.body?.error).toBe('usage_cap_reached')
  })

  it('STANDARD under cap is allowed', async () => {
    const userId = await getUserAId()
    const gate = await checkFeatureCap(userId, 'STANDARD', 'messageAnalysis')
    expect(gate.allowed).toBe(true)
  })
})

// ── Route-layer enforcement on message analysis ──────────────────────────────

describe('POST /api/message-analysis/analyze — gate', () => {
  it('FREE user is LOCKED: 402 tier_required, AI never called', async () => {
    setAuthUser(TEST_CLERK_ID_A) // user A defaults to permanent FREE
    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `free-locked-${Date.now()}`, save: false, passes: 1 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('tier_required')
    expect(res.body.feature).toBe('messageAnalysis')
    expect(mockAnalyzeMessage).not.toHaveBeenCalled()
  })

  it('active TRIAL user UNDER the sample cap succeeds (200) and calls the AI', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setUserState({
      trialStartedAt: new Date(Date.now() - DAY),
      trialEndsAt: new Date(Date.now() + DAY),
    })

    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `trial-under-${Date.now()}`, save: false, passes: 1 })

    expect(res.status).toBe(200)
    expect(mockAnalyzeMessage).toHaveBeenCalledTimes(1)
  })

  it('active TRIAL user AT the sample cap gets 402 usage_cap_reached', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const userId = await getUserAId()
    await setUserState({
      trialStartedAt: new Date(Date.now() - DAY),
      trialEndsAt: new Date(Date.now() + DAY),
    })
    await seedAnalyses(userId, TIER_CAPS.TRIAL.messageAnalysis)

    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `trial-at-cap-${Date.now()}`, save: false, passes: 1 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('usage_cap_reached')
    expect(mockAnalyzeMessage).not.toHaveBeenCalled()
  })

  it('STANDARD user under cap succeeds (200) and calls the AI', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setUserState({ plan: 'STANDARD', subscriptionStatus: 'active' })

    const res = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `standard-under-${Date.now()}`, save: false, passes: 1 })

    expect(res.status).toBe(200)
    expect(mockAnalyzeMessage).toHaveBeenCalledTimes(1)
  })

  it('a top-up raises the period cap and unblocks an at-cap paid user', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const userId = await getUserAId()
    await setUserState({
      trialStartedAt: new Date(Date.now() - DAY),
      trialEndsAt: new Date(Date.now() + DAY),
    })
    await seedAnalyses(userId, TIER_CAPS.TRIAL.messageAnalysis) // at cap

    const blocked = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `pre-topup-${Date.now()}`, save: false, passes: 1 })
    expect(blocked.status).toBe(402)
    expect(blocked.body.error).toBe('usage_cap_reached')

    await applyTopUp(userId, 'messageAnalysis', 5)

    const usage = await getFeatureUsage(userId, 'TRIAL', 'messageAnalysis')
    expect(usage.cap).toBe(TIER_CAPS.TRIAL.messageAnalysis + 5)
    expect(usage.atCap).toBe(false)

    const unblocked = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `post-topup-${Date.now()}`, save: false, passes: 1 })
    expect(unblocked.status).toBe(200)
    expect(mockAnalyzeMessage).toHaveBeenCalledTimes(1)
  })
})

// ── Clarity route is locked at FREE ──────────────────────────────────────────

describe('POST /api/clarity/sessions/[id]/messages — gate', () => {
  it('FREE user is LOCKED: 402 tier_required before any stream opens', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const userId = await getUserAId()
    const session = await prisma.claritySession.create({
      data: { userId, title: 'cap test' },
    })
    try {
      const res = await api()
        .post(`/api/clarity/sessions/${session.id}/messages`)
        .send({ content: 'hello' })
      expect(res.status).toBe(402)
      expect(res.body.error).toBe('tier_required')
      expect(res.body.feature).toBe('clarity')
    } finally {
      await prisma.clarityMessage.deleteMany({ where: { sessionId: session.id } })
      await prisma.claritySession.delete({ where: { id: session.id } })
    }
  })
})

// ── Cases is the flat paid-only gate (not metered) ───────────────────────────

describe('GET /api/cases — paid-tier-only', () => {
  it('FREE user is locked out with 402 tier_required (feature: cases)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/cases')
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('tier_required')
    expect(res.body.feature).toBe('cases')
  })

  it('an active-trial user does NOT get Cases (trial is AI caps only)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setUserState({
      trialStartedAt: new Date(Date.now() - DAY),
      trialEndsAt: new Date(Date.now() + DAY),
    })
    const res = await api().get('/api/cases')
    expect(res.status).toBe(402)
    expect(res.body.feature).toBe('cases')
  })

  it('a paid (STANDARD) user reaches Cases data (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await setUserState({ plan: 'STANDARD', subscriptionStatus: 'active' })
    const res = await api().get('/api/cases')
    expect(res.status).toBe(200)
  })
})

// ── Lapsed paid → FREE-locked, but records stay readable (never read-only) ───

describe('lapsed paid subscriber → FREE', () => {
  it('is locked out of metered AI yet can still READ its own records', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const userId = await getUserAId()
    await setUserState({ plan: 'PREMIUM', subscriptionStatus: 'canceled' })
    await seedAnalyses(userId, 2) // existing records authored while paid

    // Reading own records still works (not a capped action).
    const read = await api().get('/api/message-analysis')
    expect(read.status).toBe(200)
    expect(Array.isArray(read.body.data.analyses)).toBe(true)

    // But the metered AI feature is locked (tier_required, not read-only).
    const analyze = await api()
      .post('/api/message-analysis/analyze')
      .send({ content: `lapsed-${Date.now()}`, save: false, passes: 1 })
    expect(analyze.status).toBe(402)
    expect(analyze.body.error).toBe('tier_required')
  })
})

// ── Usage counting counts only the current period ────────────────────────────

describe('getFeatureUsage — period scoping', () => {
  it('does not count rows from before the current period', async () => {
    const userId = await getUserAId()
    await wipeUserAUsage(userId)

    const lastMonth = new Date(getCurrentPeriodStart().getTime() - DAY)
    const old = await prisma.messageAnalysis.create({
      data: { userId, content: 'old', analysisJson: {}, patternFlags: [] },
    })
    await prisma.$executeRawUnsafe(
      `UPDATE "MessageAnalysis" SET "createdAt" = $1 WHERE id = $2`,
      lastMonth,
      old.id
    )
    await seedAnalyses(userId, 1)

    const usage = await getFeatureUsage(userId, 'STANDARD', 'messageAnalysis')
    expect(usage.used).toBe(1)
  })
})

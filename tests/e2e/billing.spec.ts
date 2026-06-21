import { test, expect } from './setup/auth'
import {
  setUserTier,
  setUserPlan,
  cleanupUserRecordings,
  cleanupUserMessageAnalyses,
  seedRecordingsAtCap,
  seedMessageAnalysesAtCap,
} from './helpers/db'

// ─────────────────────────────────────────────────────────────────────────────
// Usage-cap pricing model (ADR-021). Every tier has every feature; tiers differ
// only by monthly caps. FREE is permanent (no EXPIRED, no trial expiry banner).
// ─────────────────────────────────────────────────────────────────────────────

// ── Plans page — /settings/plans ─────────────────────────────────────────────

test('plans page — FREE user sees all three usage-tier cards', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/settings/plans')
  await page.waitForLoadState('load')

  await expect(page.getByRole('heading', { name: /^free$/i }).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /choose standard/i }).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /choose premium/i }).first()).toBeVisible({ timeout: 5000 })
})

test('plans page — shows current-period usage and top-up entry points', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/settings/plans')
  await page.waitForLoadState('load')

  await expect(page.getByText(/this period/i).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /add more/i }).first()).toBeVisible({ timeout: 5000 })
})

test('plans page — STANDARD user sees Standard highlighted as current plan', async ({ page }) => {
  const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'STANDARD', {
    subscriptionStatus: 'active',
    currentPeriodEnd: renewalDate,
    cancelAtPeriodEnd: false,
    hasEverSubscribed: true,
  })

  try {
    await page.goto('/settings/plans')
    await page.waitForLoadState('load')
    await expect(page.getByText(/your plan/i).first()).toBeVisible({ timeout: 5000 })
  } finally {
    await setUserPlan(process.env.E2E_CLERK_USER_ID!, 'FREE')
  }
})

test('plans page — PREMIUM user sees Premium highlighted as current plan', async ({ proPage: page }) => {
  const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'PREMIUM', {
    subscriptionStatus: 'active',
    currentPeriodEnd: renewalDate,
    cancelAtPeriodEnd: false,
    hasEverSubscribed: true,
  })

  await page.goto('/settings/plans')
  await page.waitForLoadState('load')

  await expect(page.getByText(/your plan/i).first()).toBeVisible({ timeout: 5000 })
})

test('plans page — ?success=true shows a confirmation banner', async ({ page }) => {
  await page.goto('/settings/plans?success=true')
  await page.waitForLoadState('load')

  await expect(
    page.getByText(/your updated limits are active/i)
  ).toBeVisible({ timeout: 5000 })
})

test('plans page — ?canceled=true shows the calm no-change note', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/settings/plans?canceled=true')
  await page.waitForLoadState('load')

  await expect(
    page.getByText(/no worries.*nothing changed/i)
  ).toBeVisible({ timeout: 5000 })
})

test('plans page — annual billing is pre-selected', async ({ page }) => {
  await page.goto('/settings/plans')
  await page.waitForLoadState('load')

  const annualBtn = page.getByRole('button', { name: /annual/i })
  await expect(annualBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
})

// ── Display is no longer gated — every tier sees its own generated artifacts ──

test('display — FREE user sees full recording report content (not gated)', async ({ page }) => {
  const clerkId = process.env.E2E_CLERK_USER_ID!
  await setUserTier(clerkId, 'FREE', { hasEverSubscribed: false })
  const lastRecordingId = await seedRecordingsAtCap(clerkId, 1)

  try {
    await page.goto(`/recordings/${lastRecordingId}`)
    await page.waitForLoadState('load')

    await expect(page.getByText(/E2E test recording report/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/upgrade to premium to see your full results/i)).not.toBeVisible({
      timeout: 2000,
    })
  } finally {
    await cleanupUserRecordings(clerkId)
  }
})

test('display — FREE user sees full message analysis content (not gated)', async ({ page }) => {
  const clerkId = process.env.E2E_CLERK_USER_ID!
  await setUserTier(clerkId, 'FREE', { hasEverSubscribed: false })
  const lastAnalysisId = await seedMessageAnalysesAtCap(clerkId, 1)

  try {
    await page.goto(`/message-analysis/${lastAnalysisId}`)
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /assessment/i }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/upgrade to premium to see your full results/i)).not.toBeVisible({
      timeout: 2000,
    })
  } finally {
    await cleanupUserMessageAnalyses(clerkId)
  }
})

// ── FREE is LOCKED out of the metered AI features (ADR-021 REVISED) ───────────
// FREE is journal + own-export + ToneEval only. Message analysis is a paid
// feature, so the FREE analyze surface shows a calm in-place upgrade state —
// not a "used this period" allowance meter, and not a hard redirect.

test('cap — FREE user sees the paid-feature upgrade lock on the analyze surface', async ({ page }) => {
  const clerkId = process.env.E2E_CLERK_USER_ID!
  await setUserTier(clerkId, 'FREE', { hasEverSubscribed: false })

  await page.goto('/message-analysis/analyze')
  await page.waitForLoadState('load')

  expect(page.url()).toContain('/message-analysis/analyze')
  await expect(page.getByText(/part of a paid plan/i).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('link', { name: /see plans/i }).first()).toBeVisible({ timeout: 5000 })
})

test('cap — paid user at message-analysis cap sees the usage lock (used this period)', async ({ page }) => {
  const clerkId = process.env.E2E_CLERK_USER_ID!
  await setUserTier(clerkId, 'STANDARD', { subscriptionStatus: 'active', hasEverSubscribed: true })
  // STANDARD messageAnalysis cap is 25; seed exactly the cap in the current period.
  await seedMessageAnalysesAtCap(clerkId, 25)

  try {
    await page.goto('/message-analysis/analyze')
    await page.waitForLoadState('load')
    await expect(page.getByText(/used this period/i).first()).toBeVisible({ timeout: 5000 })
  } finally {
    await cleanupUserMessageAnalyses(clerkId)
    await setUserPlan(clerkId, 'FREE')
  }
})

// ── Sidebar plan badge (no EXPIRED) ──────────────────────────────────────────

test('sidebar badge — FREE user shows "Free"', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/journal')
  await page.waitForLoadState('load')

  await expect(page.getByText('Free', { exact: true }).first()).toBeVisible({ timeout: 5000 })
})

test('sidebar badge — STANDARD user shows "Standard"', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'STANDARD', {
    subscriptionStatus: 'active',
    hasEverSubscribed: true,
  })

  try {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    await expect(page.getByText('Standard').first()).toBeVisible({ timeout: 5000 })
  } finally {
    await setUserPlan(process.env.E2E_CLERK_USER_ID!, 'FREE')
  }
})

test('sidebar badge — PREMIUM user shows "Premium"', async ({ proPage: page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'PREMIUM', {
    subscriptionStatus: 'active',
    hasEverSubscribed: true,
  })

  await page.goto('/journal')
  await page.waitForLoadState('load')

  await expect(page.getByText('Premium').first()).toBeVisible({ timeout: 5000 })
})

// ── Permanent-FREE access (lapsed/free users keep full access) ───────────────

test('access — FREE user can create a new entry (never read-only)', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/journal/new')
  await page.waitForLoadState('load')

  expect(page.url()).toContain('/journal/new')
  await expect(page.getByRole('heading', { name: /new journal entry/i })).toBeVisible({ timeout: 5000 })
})

test('access — FREE user sees Cases upgrade state, not Cases data (B1a)', async ({ page }) => {
  // Cases is the one PAID-TIER-ONLY feature (ADR-021 exception, security sweep
  // B1a). A FREE Parent reaching /cases gets a calm in-place upgrade state — NOT
  // the Cases data, and NOT a hard redirect to the plans page.
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/cases')
  await page.waitForLoadState('load')

  expect(page.url()).toContain('/cases')
  expect(page.url()).not.toContain('/settings/plans')
  await expect(page.getByText(/cases are part of a paid plan/i)).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('link', { name: /see plans/i })).toBeVisible({ timeout: 5000 })
})

test('access — paid (STANDARD) user gets Cases data, not the upgrade state (B1a)', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'STANDARD', {
    subscriptionStatus: 'active',
    hasEverSubscribed: true,
  })
  try {
    await page.goto('/cases')
    await page.waitForLoadState('load')

    expect(page.url()).toContain('/cases')
    await expect(page.getByText(/cases are part of a paid plan/i)).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('link', { name: /new case/i }).first()).toBeVisible({ timeout: 5000 })
  } finally {
    await setUserPlan(process.env.E2E_CLERK_USER_ID!, 'FREE')
  }
})

test('access — lapsed PREMIUM (canceled) falls back to FREE but keeps access', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'PREMIUM', {
    subscriptionStatus: 'canceled',
    hasEverSubscribed: true,
  })

  try {
    await page.goto('/journal/new')
    await page.waitForLoadState('load')
    expect(page.url()).toContain('/journal/new')
    await expect(page.getByRole('heading', { name: /new journal entry/i })).toBeVisible({ timeout: 5000 })
  } finally {
    await setUserPlan(process.env.E2E_CLERK_USER_ID!, 'FREE')
  }
})

// ── Clarity is available to every tier ───────────────────────────────────────

test('access — Clarity is available for FREE users', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { hasEverSubscribed: false })

  await page.goto('/journal')
  await page.waitForLoadState('load')

  await expect(page.getByRole('button', { name: /clarity/i }).first()).toBeVisible({ timeout: 5000 })
})

import { test, expect } from './setup/auth'
import {
  setUserTier,
  createTestEntry,
  deleteTestEntry,
  createTestInsightReport,
  deleteTestInsightReport,
  createTestEntryWithDate,
} from './helpers/db'

const E2E_CLERK_ID = process.env.E2E_CLERK_USER_ID!

// ─────────────────────────────────────────────────────────────────────────────
// A1 — InsightReport trigger labels
//
// Prerequisites: PREMIUM user, one entry ≥90 days old so the threshold is met,
// and seeded InsightReport records with specific triggerTypes.
// ─────────────────────────────────────────────────────────────────────────────

test('insight-report list — shows "Quarterly Report" not "SCHEDULED"', async ({ page }) => {
  const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
  const oldEntryId = await createTestEntryWithDate(E2E_CLERK_ID, ninetyFiveDaysAgo, 'E2E Old Entry for Threshold')
  const reportId = await createTestInsightReport(E2E_CLERK_ID, 'SCHEDULED')

  await setUserTier(E2E_CLERK_ID, 'PREMIUM', { subscriptionStatus: 'active', hasEverSubscribed: true })

  try {
    await page.goto('/insight-reports')
    await page.waitForLoadState('load')

    await expect(page.getByText('Quarterly Report', { exact: false })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('SCHEDULED', { exact: true })).not.toBeVisible()
  } finally {
    await deleteTestInsightReport(reportId)
    await deleteTestEntry(oldEntryId)
    await setUserTier(E2E_CLERK_ID, 'FREE', { subscriptionStatus: null, hasEverSubscribed: false })
  }
})

test('insight-report list — shows "Alert Report" not "VELOCITY"', async ({ page }) => {
  const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
  const oldEntryId = await createTestEntryWithDate(E2E_CLERK_ID, ninetyFiveDaysAgo, 'E2E Old Entry for Alert')
  const reportId = await createTestInsightReport(E2E_CLERK_ID, 'VELOCITY')

  await setUserTier(E2E_CLERK_ID, 'PREMIUM', { subscriptionStatus: 'active', hasEverSubscribed: true })

  try {
    await page.goto('/insight-reports')
    await page.waitForLoadState('load')

    await expect(page.getByText('Alert Report', { exact: false })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('VELOCITY', { exact: true })).not.toBeVisible()
  } finally {
    await deleteTestInsightReport(reportId)
    await deleteTestEntry(oldEntryId)
    await setUserTier(E2E_CLERK_ID, 'FREE', { subscriptionStatus: null, hasEverSubscribed: false })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// A5 — Clarity compass button visible at desktop viewport width
// ─────────────────────────────────────────────────────────────────────────────

test('clarity — compass button is visible at desktop viewport (1280px)', async ({ proPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/journal')
  await page.waitForLoadState('load')

  await expect(
    page.getByRole('button', { name: /^(Open|Close) Clarity$/ })
  ).toBeVisible({ timeout: 10000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// A7 — Audit trail never shows negative modification count
//
// An entry created via the DB helper has no revisions (revisionCount=0).
// Before the fix: "Modified -1 times". After the fix: "Modified 0 times".
// ─────────────────────────────────────────────────────────────────────────────

test('audit-trail — zero revisions shows "Modified 0 times" not negative', async ({ page }) => {
  const entryId = await createTestEntry(E2E_CLERK_ID, 'E2E Imported Entry No Revisions')

  try {
    await page.goto(`/journal/${entryId}`)
    await page.waitForLoadState('load')

    // Should never show a negative modification count
    await expect(page.getByText(/Modified -\d+ time/)).not.toBeVisible()

    // Should show "Modified 0 times" since there are no revisions
    await expect(page.getByText('Modified 0 times', { exact: false })).toBeVisible({ timeout: 8000 })
  } finally {
    await deleteTestEntry(entryId)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// A4 — Plan card buttons are vertically aligned
//
// "Choose Standard" and "Choose Premium" should appear at the same Y position
// because both cards are flex-col with the button pinned to the bottom via mt-auto.
// ─────────────────────────────────────────────────────────────────────────────

test('plans page — Standard and Premium card buttons are vertically aligned', async ({ page }) => {
  await setUserTier(E2E_CLERK_ID, 'FREE', {
    trialStartedAt: new Date(),
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    hasEverSubscribed: false,
  })

  await page.goto('/settings/plans')
  await page.waitForLoadState('load')

  const standardBtn = page.getByRole('button', { name: /choose standard/i })
  const premiumBtn = page.getByRole('button', { name: /choose premium/i })

  await expect(standardBtn).toBeVisible({ timeout: 8000 })
  await expect(premiumBtn).toBeVisible({ timeout: 8000 })

  const standardBox = await standardBtn.boundingBox()
  const premiumBox = await premiumBtn.boundingBox()

  expect(standardBox).not.toBeNull()
  expect(premiumBox).not.toBeNull()

  // Buttons should start at the same vertical position (within 4px tolerance)
  expect(Math.abs((standardBox!.y) - (premiumBox!.y))).toBeLessThanOrEqual(4)
})

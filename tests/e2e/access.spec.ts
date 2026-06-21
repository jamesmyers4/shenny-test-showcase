import { test, expect } from './setup/auth'
import { MessageAnalysisPage } from './pages/MessageAnalysisPage'
import { JournalNewPage } from './pages/JournalNewPage'
import { MOCK_NO_SPLIT_RESPONSE, uniqueTitle } from './fixtures/entries'
import { setUserTier, setUserPlan } from './helpers/db'

// ─────────────────────────────────────────────────────────────────────────────
// Usage-cap model (ADR-021): every tier has every feature. The difference is the
// monthly cap, enforced at the route. There is no feature lock and no read-only
// EXPIRED state.
// ─────────────────────────────────────────────────────────────────────────────

test('access — FREE user can reach Message Analysis (no feature lock)', async ({ page }) => {
  const msgPage = new MessageAnalysisPage(page)
  await msgPage.goto()
  await msgPage.expectAnalyzeButtonVisible()
})

test('access — FREE user can reach Insight Reports (no feature lock)', async ({ page }) => {
  await page.goto('/insight-reports')
  await page.waitForLoadState('load')
  // No "Upgrade to Premium" gate — the page renders for every tier.
  await expect(
    page.getByText(/upgrade to premium to unlock insight reports/i)
  ).not.toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('heading', { name: /insight reports/i }).first()).toBeVisible({
    timeout: 5000,
  })
})

test('access — STANDARD user can reach Insight Reports', async ({ page }) => {
  await setUserTier(process.env.E2E_CLERK_USER_ID!, 'STANDARD', {
    subscriptionStatus: 'active',
    hasEverSubscribed: true,
  })
  try {
    await page.goto('/insight-reports')
    await page.waitForLoadState('load')
    await expect(
      page.getByText(/upgrade to premium to unlock insight reports/i)
    ).not.toBeVisible({ timeout: 3000 })
  } finally {
    await setUserPlan(process.env.E2E_CLERK_USER_ID!, 'FREE')
  }
})

test('access — tone badge displays on journal entry detail for all tiers', async ({ page }) => {
  const newEntry = new JournalNewPage(page)
  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_NO_SPLIT_RESPONSE)
  await newEntry.fillTitle(uniqueTitle('Tone badge test'))
  await newEntry.fillSummary('Dropped Hudson off at school. He seemed happy.')
  await newEntry.selectCategory('INCIDENT')
  await newEntry.fillDate(new Date().toISOString().split('T')[0])
  await newEntry.submit()
  await newEntry.waitForDetailRedirect()
  await page.waitForLoadState('load')

  // ToneBadge always renders for all tiers. A fresh entry shows "Evaluating"
  // while ToneEval runs; once complete it shows a tone value. Either is correct.
  const toneBlock = page.getByText('Evaluating').or(
    page.locator('span').filter({ hasText: /^(POSITIVE|NEUTRAL|NOTABLE|CONCERNING|CRITICAL)$/ })
  )
  await expect(toneBlock.first()).toBeVisible({ timeout: 5000 })
})

test('access — PREMIUM user sees analyze button on Message Analysis page', async ({ proPage: page }) => {
  const msgPage = new MessageAnalysisPage(page)
  await msgPage.goto()
  await msgPage.expectAnalyzeButtonVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — no feature-lock icons (Cases/Exports/Message Analysis open to all)
// ─────────────────────────────────────────────────────────────────────────────

test('access — sidebar has no lock icon on Message Analysis for FREE user', async ({ page }) => {
  await page.goto('/journal')
  await page.waitForLoadState('load')

  const navLink = page.locator('a[href="/message-analysis"]')
  await expect(navLink).toBeVisible({ timeout: 5000 })
  // The nav link renders a single icon (the nav icon). The old "locked" lock
  // SVG is gone, so there is exactly one svg.
  await expect(navLink.locator('svg')).toHaveCount(1)
})

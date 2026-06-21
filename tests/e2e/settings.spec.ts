import { test, expect } from './setup/auth'
import { SettingsPage } from './pages/SettingsPage'

// ─────────────────────────────────────────────────────────────────────────────
// Settings page — plan-gated elements and danger zone
// ─────────────────────────────────────────────────────────────────────────────

test('settings — manage plan link visible for FREE user', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.goto()
  await settings.expectManagePlanLinkVisible()
})

test('settings — manage plan link visible for Premium user', async ({ proPage: page }) => {
  const settings = new SettingsPage(page)
  await settings.goto()
  await settings.expectManagePlanLinkVisible()
})

test('settings — danger zone is present on settings page', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.goto()
  await settings.expectDangerZoneVisible()
})

test('settings — delete confirmation button inactive until DELETE typed', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.goto()

  const deleteBtn = page.getByRole('button', { name: /delete my account/i })
  await expect(deleteBtn).toBeVisible({ timeout: 5000 })
  // Button must be disabled before the confirmation word is typed
  await expect(deleteBtn).toBeDisabled()

  await settings.typeDeleteConfirmation()
  // Button becomes enabled once "DELETE" is in the input
  await expect(deleteBtn).toBeEnabled()
})

// ─────────────────────────────────────────────────────────────────────────────
// Stripe checkout — mocked, never hits live Stripe
// ─────────────────────────────────────────────────────────────────────────────

test('settings — plan selector renders with annual pre-selected', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.expectAnnualPreselected()
})

test('settings — Standard and Premium plan options visible with pricing', async ({ page }) => {
  const settings = new SettingsPage(page)
  await settings.expectPlanOptionsVisible()
  await settings.expectPricingCopy()
})

test('settings — clicking upgrade calls mocked checkout endpoint', async ({ page }) => {
  let checkoutCalled = false

  await page.route('**/api/stripe/checkout', (route) => {
    if (route.request().method() === 'POST') {
      checkoutCalled = true
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/test' }),
      })
    } else {
      void route.continue()
    }
  })

  // Block navigation to Stripe checkout so the test doesn't actually redirect
  await page.route('https://checkout.stripe.com/**', (route) => void route.abort())

  const settings = new SettingsPage(page)
  await page.goto('/settings/plans')
  await settings.clickUpgradeOnPlansPage()

  await page.waitForTimeout(500)
  expect(checkoutCalled).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// Account deletion — UI-only test, API mocked
//
// IMPORTANT: The real DELETE /api/user/delete endpoint revokes the Clerk session
// and sets deletedAt on the test user. Calling it live would break every
// subsequent test in the run. The mock returns a plausible success shape and
// we assert only the UI confirmation message.
// ─────────────────────────────────────────────────────────────────────────────

test('settings — delete account shows confirmation after submit (API mocked)', async ({ page }) => {
  // Intercept the delete endpoint before navigating
  await page.route('**/api/user/delete', (route) => {
    if (route.request().method() === 'DELETE') {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scheduled: true,
          deletionDate: '2026-06-22T00:00:00.000Z',
        }),
      })
    } else {
      void route.continue()
    }
  })

  const settings = new SettingsPage(page)
  await settings.goto()
  await settings.typeDeleteConfirmation()
  await settings.clickDeleteAccount()

  // Confirmation message contains "30 days" — appears in place of the form
  await expect(
    page.getByText(/30 days/i)
  ).toBeVisible({ timeout: 5000 })
})

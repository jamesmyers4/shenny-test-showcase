import { test, expect } from '@playwright/test'
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'

test('visual: dashboard sidebar', async ({ page }) => {
  await setupClerkTestingToken({ page })
  // Go straight to a protected route — Clerk middleware redirects to /sign-in,
  // then signIn() injects the session and bounces us back.
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! })

  // After signIn() the page may land on / or /dashboard depending on afterSignIn.
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('shenny_mfa_nag_dismissed', '1'))
  await page.reload({ waitUntil: 'domcontentloaded' })

  await page.locator('nav').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)

  await page.screenshot({ path: 'tmp-screens/dashboard-expanded.png', fullPage: false })

  const sidebarBg = await page.locator('nav').first().evaluate((el) => {
    const sidebar = el.closest('div[class*="bg-"]')
    return sidebar ? getComputedStyle(sidebar).backgroundColor : 'n/a'
  })
  console.log('SIDEBAR PARENT BG:', sidebarBg)

  // Collapse
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'tmp-screens/dashboard-collapsed.png', fullPage: false })

  await page.getByRole('link', { name: 'Parent Journal' }).first().hover()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'tmp-screens/dashboard-collapsed-tooltip.png', fullPage: false })

  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'tmp-screens/dashboard-re-expanded.png', fullPage: false })

  expect(sidebarBg).toBe('rgb(35, 35, 40)')
})

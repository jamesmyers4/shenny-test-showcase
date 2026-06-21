import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'
import { setUserPlan, setUserTier } from '../helpers/db'

// Extend Playwright's test with a pre-authenticated page fixture.
// Every test that imports from this file gets a Clerk session injected
// without any UI login — no sign-in form, no MFA.
//
// proPage — CLERK AUTH NOTE:
// The seeded Premium fixture user (see global-setup.ts) exists only in the DB and
// has no Clerk account. clerk.signIn() would fail for that user. Instead,
// proPage temporarily elevates the primary Clerk user's plan to PREMIUM for the
// duration of the test, then restores it to FREE. This is the correct pattern
// when only one real Clerk test account is available. To run Premium tests against
// a truly distinct Clerk user, create a second account in the Clerk dev
// dashboard and set E2E_PREMIUM_CLERK_USER_ID + E2E_PREMIUM_CLERK_USER_EMAIL in .env.test.

type ExtraFixtures = { proPage: Page }

export const test = base.extend<ExtraFixtures>({
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page })
    await page.goto('/')
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! })
    // Suppress MFA nag banner — localStorage dismiss persists across all navigations
    await page.evaluate(() => localStorage.setItem('shenny_mfa_nag_dismissed', '1'))
    await use(page)
  },

  // proPage re-uses the already-authenticated `page` fixture (auth is handled there).
  // It only changes the DB plan to PREMIUM before the test and restores FREE after.
  // The try-finally ensures restoration even when the test itself fails.
  proPage: async ({ page }, use) => {
    await setUserTier(process.env.E2E_CLERK_USER_ID!, 'PREMIUM', { subscriptionStatus: 'active', hasEverSubscribed: true })
    try {
      await use(page)
    } finally {
      await setUserTier(process.env.E2E_CLERK_USER_ID!, 'FREE', { subscriptionStatus: null, hasEverSubscribed: false })
    }
  },
})

export { expect }

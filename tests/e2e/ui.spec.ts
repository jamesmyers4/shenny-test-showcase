import { test, expect } from './setup/auth'

// ─────────────────────────────────────────────────────────────────────────────
// MFA nag banner — dismissed state persists via localStorage
//
// The auth fixture sets localStorage.shenny_mfa_nag_dismissed = '1' after
// every sign-in. The MfaNagBanner component checks this key in useEffect and
// stays hidden when the key is present.
//
// This test verifies that the localStorage guard in auth.ts is working:
// the banner must NOT appear even when the Clerk test user has no 2FA enabled
// (which triggers server-side rendering of the banner component).
// ─────────────────────────────────────────────────────────────────────────────

test('ui — MFA nag banner is hidden when localStorage dismiss key is set', async ({ page }) => {
  await page.goto('/journal')
  await page.waitForLoadState('load')

  // Banner text is "Protect your records — enable two-factor authentication..."
  // If the banner is present, this assertion fails and the localStorage guard
  // in auth.ts needs to be fixed.
  await expect(page.getByText('Protect your records', { exact: false })).not.toBeVisible({
    timeout: 3000,
  })
})

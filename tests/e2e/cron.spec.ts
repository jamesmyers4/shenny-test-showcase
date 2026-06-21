import { test, expect } from './setup/auth'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─────────────────────────────────────────────────────────────────────────────
// Cron route auth — smoke tests confirming 401 without CRON_SECRET
//
// These use page.request directly so the Clerk session cookie is included
// but no Authorization header is sent. The cron routes check the Bearer token
// before any Clerk auth, so they must return 401 regardless of session state.
// ─────────────────────────────────────────────────────────────────────────────

test('cron — context-snapshot returns 401 without CRON_SECRET', async ({ page }) => {
  const response = await page.request.get(`${BASE}/api/cron/context-snapshot`)
  expect(response.status()).toBe(401)
})

test('cron — purge-deleted-users returns 401 without CRON_SECRET', async ({ page }) => {
  const response = await page.request.get(`${BASE}/api/cron/purge-deleted-users`)
  expect(response.status()).toBe(401)
})

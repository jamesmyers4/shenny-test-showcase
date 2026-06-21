import { test, expect } from './setup/auth'
import { createTestEntry, deleteTestEntry } from './helpers/db'

// ─────────────────────────────────────────────────────────────────────────────
// Journal page size selector
// Page size selector only renders when entries exist, so we seed one entry
// in beforeAll and clean up in afterAll.
// ─────────────────────────────────────────────────────────────────────────────

let seededEntryId: string

test.beforeAll(async () => {
  seededEntryId = await createTestEntry(
    process.env.E2E_CLERK_USER_ID!,
    'Pagination test entry'
  )
})

test.afterAll(async () => {
  if (seededEntryId) {
    await deleteTestEntry(seededEntryId)
  }
})

test('journal pagination — page size selector is visible', async ({ page }) => {
  await page.goto('/journal')
  await page.waitForLoadState('load')

  await expect(page.getByTestId('page-size-10')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('page-size-25')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('page-size-50')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('page-size-100')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('page-size-all')).toBeVisible({ timeout: 5000 })
})

test('journal pagination — clicking 50 updates URL to pageSize=50', async ({ page }) => {
  await page.goto('/journal')
  await page.waitForLoadState('load')

  await page.getByTestId('page-size-50').click()
  await page.waitForURL(/pageSize=50/, { timeout: 5000 })

  expect(page.url()).toContain('pageSize=50')
})

test('journal pagination — clicking All updates URL to pageSize=0 and shows count text', async ({ page }) => {
  await page.goto('/journal')
  await page.waitForLoadState('load')

  await page.getByTestId('page-size-all').click()
  await page.waitForURL(/pageSize=0/, { timeout: 5000 })

  expect(page.url()).toContain('pageSize=0')
  await expect(page.getByText(/Showing all/)).toBeVisible({ timeout: 5000 })
})

test('journal pagination — page size persists in URL and active button is highlighted', async ({ page }) => {
  await page.goto('/journal?pageSize=10')
  await page.waitForLoadState('load')

  const btn10 = page.getByTestId('page-size-10')
  await expect(btn10).toBeVisible({ timeout: 5000 })
  await expect(btn10).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })

  expect(page.url()).toContain('pageSize=10')
})

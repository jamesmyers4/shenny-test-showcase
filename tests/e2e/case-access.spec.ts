import { test, expect } from './setup/auth'
import {
  createTestCase,
  deleteTestCase,
  createTestCaseAccess,
  deleteTestCaseAccess,
} from './helpers/db'

// ─────────────────────────────────────────────────────────────────────────────
// CaseAccess — grant/revoke UI (API mocked where writes are needed)
// ─────────────────────────────────────────────────────────────────────────────

test('case-access — grant form renders with all fields', async ({ page }) => {
  const caseId = await createTestCase(process.env.E2E_CLERK_USER_ID!)
  try {
    await page.goto(`/cases/${caseId}/access`)
    await page.waitForLoadState('load')

    await page.getByRole('button', { name: /grant access/i }).click()

    await expect(page.getByTestId('access-email')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('access-role')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('scope-case_scoped')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('scope-full')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('exclude-entries')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('exclude-recordings')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('exclude-messages')).toBeVisible({
      timeout: 5000,
    })
  } finally {
    await deleteTestCase(caseId)
  }
})

test('case-access — scope toggle changes selection correctly', async ({
  page,
}) => {
  const caseId = await createTestCase(process.env.E2E_CLERK_USER_ID!)
  try {
    await page.goto(`/cases/${caseId}/access`)
    await page.waitForLoadState('load')
    await page.getByRole('button', { name: /grant access/i }).click()

    const fullBtn = page.getByTestId('scope-full')
    await fullBtn.click()
    await expect(fullBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 3000 })

    const caseBtn = page.getByTestId('scope-case_scoped')
    await caseBtn.click()
    await expect(caseBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 3000 })
  } finally {
    await deleteTestCase(caseId)
  }
})

test('case-access — grant form calls mocked POST endpoint', async ({
  page,
}) => {
  const caseId = await createTestCase(process.env.E2E_CLERK_USER_ID!)
  let grantCalled = false

  try {
    await page.route(`**/api/cases/${caseId}/access`, (route) => {
      if (route.request().method() === 'POST') {
        grantCalled = true
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            grant: {
              id: 'test-grant-id',
              inviteEmail: 'lawyer@example.com',
              role: 'ATTORNEY',
              scope: 'CASE_SCOPED',
              excludedDataTypes: [],
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              grantedAt: null,
              revokedAt: null,
            },
          }),
        })
      } else {
        void route.continue()
      }
    })

    await page.goto(`/cases/${caseId}/access`)
    await page.waitForLoadState('load')
    await page.getByRole('button', { name: /grant access/i }).click()
    await page.getByTestId('access-email').fill('lawyer@example.com')
    await page.getByTestId('access-submit').click()

    await page.waitForTimeout(500)
    expect(grantCalled).toBe(true)
  } finally {
    await deleteTestCase(caseId)
  }
})

test('case-access — revoke shows inline confirmation before acting', async ({
  page,
}) => {
  const caseId = await createTestCase(process.env.E2E_CLERK_USER_ID!)
  const accessId = await createTestCaseAccess(caseId)
  try {
    await page.goto(`/cases/${caseId}/access`)
    await page.waitForLoadState('load')

    // Click revoke — should show inline confirmation, not immediately revoke
    await page.getByTestId('revoke-button').click()
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('revoke-confirm')).toBeVisible({
      timeout: 5000,
    })
  } finally {
    await deleteTestCaseAccess(accessId)
    await deleteTestCase(caseId)
  }
})

test('case-access — revoke calls mocked PATCH endpoint on confirm', async ({
  page,
}) => {
  const caseId = await createTestCase(process.env.E2E_CLERK_USER_ID!)
  const accessId = await createTestCaseAccess(caseId)
  let revokeCalled = false

  try {
    await page.route(`**/api/cases/${caseId}/access/${accessId}`, (route) => {
      if (route.request().method() === 'PATCH') {
        revokeCalled = true
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ grant: { id: accessId, status: 'REVOKED' } }),
        })
      } else {
        void route.continue()
      }
    })

    await page.goto(`/cases/${caseId}/access`)
    await page.waitForLoadState('load')

    await page.getByTestId('revoke-button').click()
    await page.getByTestId('revoke-confirm').click()

    await page.waitForTimeout(500)
    expect(revokeCalled).toBe(true)
    await expect(page.getByText(/access has been removed/i)).toBeVisible({
      timeout: 5000,
    })
  } finally {
    await deleteTestCase(caseId)
  }
})

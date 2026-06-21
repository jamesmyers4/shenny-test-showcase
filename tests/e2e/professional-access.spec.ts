import { test, expect } from './setup/auth'
import { ProfessionalViewPage } from './pages/ProfessionalViewPage'
import {
  setUserReadOnly,
  createTestEntry,
  deleteTestEntry,
} from './helpers/db'

const CLERK_ID = () => process.env.E2E_CLERK_USER_ID!

// ─────────────────────────────────────────────────────────────────────────────
// Professional read-only access tests
//
// setUserReadOnly creates a synthetic CaseAccess record with professionalId
// set to the test user's Clerk id — the isReadOnly check in layout.tsx picks
// it up on the next page navigation. try/finally guarantees cleanup even when
// a test assertion fails.
// ─────────────────────────────────────────────────────────────────────────────

test('professional-access — edit button hidden in read-only mode', async ({ page }) => {
  const entryId = await createTestEntry(CLERK_ID())
  await setUserReadOnly(CLERK_ID(), true)
  const view = new ProfessionalViewPage(page)
  try {
    await view.goto(entryId)
    await view.expectNoEditButton()
    await view.expectNoDeleteButton()
  } finally {
    await setUserReadOnly(CLERK_ID(), false)
    await deleteTestEntry(entryId)
  }
})

test('professional-access — new entry button hidden in read-only mode', async ({ page }) => {
  await setUserReadOnly(CLERK_ID(), true)
  const view = new ProfessionalViewPage(page)
  try {
    await view.gotoJournal()
    await view.expectNoNewEntryButton()
  } finally {
    await setUserReadOnly(CLERK_ID(), false)
  }
})

test('professional-access — new entry route redirects in read-only mode', async ({ page }) => {
  await setUserReadOnly(CLERK_ID(), true)
  try {
    await page.goto('/journal/new')
    await page.waitForLoadState('load')
    expect(page.url()).toContain('/journal')
    expect(page.url()).not.toContain('/journal/new')
  } finally {
    await setUserReadOnly(CLERK_ID(), false)
  }
})

test('professional-access — normal user sees edit button (regression guard)', async ({ page }) => {
  const entryId = await createTestEntry(CLERK_ID())
  const view = new ProfessionalViewPage(page)
  try {
    await view.goto(entryId)
    await expect(
      page.getByRole('link', { name: /edit entry/i })
    ).toBeVisible({ timeout: 5000 })
  } finally {
    await deleteTestEntry(entryId)
  }
})

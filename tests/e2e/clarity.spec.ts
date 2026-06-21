import { test, expect } from './setup/auth'
import { ClarityPage } from './pages/ClarityPage'
import { JournalNewPage } from './pages/JournalNewPage'
import { MOCK_NO_SPLIT_RESPONSE, uniqueTitle } from './fixtures/entries'
import { MOCK_CLARITY_RESPONSE, MOCK_CLARITY_SESSION_TITLE } from './fixtures/clarity'

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Compass button is visible on a dashboard page
//
// Prerequisites: test user has isOnboardingComplete: true (set by global-setup).
// On desktop (≥768px), ClarityButton is md:hidden. The visible control is
// the drawer tab inside ClarityPanel with aria-label "Open Clarity".
// ─────────────────────────────────────────────────────────────────────────────
test('clarity — compass button is visible on journal page', async ({ proPage: page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')

  const clarity = new ClarityPage(page)
  await clarity.expectCompassVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Compass button is visible on the journal detail page
//
// Creates an entry inline to get a valid detail URL, then asserts the compass.
// ─────────────────────────────────────────────────────────────────────────────
test('clarity — compass button is visible on journal detail page', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_NO_SPLIT_RESPONSE)
  await newEntry.fillTitle(uniqueTitle('Compass detail test'))
  await newEntry.fillSummary('Testing compass visibility on the detail page.')
  await newEntry.selectCategory('INCIDENT')
  await newEntry.fillDate(new Date().toISOString().split('T')[0])
  await newEntry.submit()
  await newEntry.waitForDetailRedirect()

  const clarity = new ClarityPage(page)
  await clarity.expectCompassVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Panel opens and closes on compass click
// ─────────────────────────────────────────────────────────────────────────────
test('clarity — panel opens and closes on compass click', async ({ proPage: page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')

  const clarity = new ClarityPage(page)

  await clarity.openPanel()
  await clarity.expectPanelOpen()

  await clarity.closePanel()
  await clarity.expectPanelClosed()
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — New session created, message sent, response received
//
// MOCK_AI=true: the messages route returns a deterministic response without
// calling Claude. The response text is defined in tests/e2e/fixtures/clarity.ts.
// ─────────────────────────────────────────────────────────────────────────────
test('clarity — new session, message sent, assistant responds', async ({ proPage: page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')

  const clarity = new ClarityPage(page)

  await clarity.openPanel()
  await clarity.startNewSession()
  await clarity.sendMessage('What should I focus on documenting right now?')
  await clarity.waitForResponse()

  await expect(page.getByText(MOCK_CLARITY_RESPONSE, { exact: false })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — Session title auto-generates after first message exchange
//
// After the first message + response, the mock handler sets the session title
// in the DB. Navigating back to the sessions list re-fetches from the server
// — the title appears.
// ─────────────────────────────────────────────────────────────────────────────
test('clarity — session title auto-generates after first message', async ({ proPage: page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')

  const clarity = new ClarityPage(page)

  await clarity.openPanel()
  await clarity.startNewSession()
  await clarity.sendMessage('What should I focus on documenting right now?')
  await clarity.waitForResponse()

  await clarity.expectSessionTitle(MOCK_CLARITY_SESSION_TITLE)
})

import { test, expect } from './setup/auth'
import { JournalNewPage } from './pages/JournalNewPage'
import { JournalDetailPage } from './pages/JournalDetailPage'
import { uniqueTitle, MOCK_NO_SPLIT_RESPONSE } from './fixtures/entries'

// ─── Picker content: new source and category values ────────────────────────

test('entry form — source picker contains PARENTSQUARE', async ({ page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')
  const sourceSelect = page.locator('select').nth(1)
  const options = await sourceSelect.locator('option').allTextContents()
  expect(options).toContain('ParentSquare')
})

test('entry form — source picker contains PERSONAL_REFLECTION', async ({ page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')
  const sourceSelect = page.locator('select').nth(1)
  const options = await sourceSelect.locator('option').allTextContents()
  expect(options).toContain('Personal Reflection')
})

test('entry form — source picker contains DOCUMENT', async ({ page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')
  const sourceSelect = page.locator('select').nth(1)
  const options = await sourceSelect.locator('option').allTextContents()
  expect(options).toContain('Document')
})

test('entry form — source picker does NOT contain VERBAL', async ({ page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')
  const sourceSelect = page.locator('select').nth(1)
  const options = await sourceSelect.locator('option').allTextContents()
  expect(options).not.toContain('Verbal')
  expect(options).not.toContain('VERBAL')
})

test('entry form — category picker contains OBSERVATION', async ({ page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')
  const categorySelect = page.locator('select').first()
  const options = await categorySelect.locator('option').allTextContents()
  expect(options).toContain('Observation')
})

// ─── eventTime field ────────────────────────────────────────────────────────

test('entry form — eventTime input field is present', async ({ page }) => {
  await page.goto('/journal/new')
  await page.waitForLoadState('load')
  await expect(page.getByPlaceholder(/around 3pm/i)).toBeVisible()
})

test('entry form — submit with empty eventTime succeeds', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_NO_SPLIT_RESPONSE)
  await newEntry.fillTitle(uniqueTitle('EventTime empty'))
  await newEntry.fillSummary('Testing empty eventTime submission.')
  await newEntry.selectCategory('INCIDENT')
  await newEntry.fillDate(new Date().toISOString().split('T')[0])
  await newEntry.submit()
  await newEntry.waitForDetailRedirect()
  // Arrival at detail page confirms the form submitted without error
  await expect(page).toHaveURL(/\/journal\/(?!new$)[a-z0-9]+$/)
})

test('entry form — submit with eventTime "14:30" displays on detail page', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  const detail = new JournalDetailPage(page)
  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_NO_SPLIT_RESPONSE)
  await newEntry.fillTitle(uniqueTitle('EventTime test'))
  await newEntry.fillSummary('Testing eventTime display on detail page.')
  await newEntry.selectCategory('INCIDENT')
  await newEntry.fillDate(new Date().toISOString().split('T')[0])
  await page.fill('input[placeholder*="around 3pm"]', '14:30')
  await newEntry.submit()
  await newEntry.waitForDetailRedirect()
  await expect(page.getByText('at 14:30')).toBeVisible()
  void detail
})

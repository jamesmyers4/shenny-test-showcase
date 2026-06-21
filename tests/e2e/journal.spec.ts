import { test, expect } from './setup/auth'
import { JournalNewPage } from './pages/JournalNewPage'
import { JournalDetailPage } from './pages/JournalDetailPage'
import {
  buildEntryPayload,
  uniqueTitle,
  MULTI_EVENT_SUMMARY,
  MOCK_SPLIT_RESPONSE,
  MOCK_NO_SPLIT_RESPONSE,
} from './fixtures/entries'

// All journal tests use proPage — tone badge and split preview are Premium-gated.
// The proPage fixture elevates the primary Clerk user's plan to PREMIUM for the
// duration of each test and restores FREE afterwards.

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Entry creation: tone evaluates and appears on the detail page
//
// Flow: fill form → split check returns no-split → redirect to detail →
//       poll until ToneEval writes tone to DB → assert badge shows a real Tone.
//
// With MOCK_AI=true, evaluateTone() returns 'NOTABLE' immediately.
// The detail page is server-rendered — we reload until the badge appears.
// ─────────────────────────────────────────────────────────────────────────────
test('entry creation — tone evaluates and displays on detail page', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  const detail = new JournalDetailPage(page)

  const payload = buildEntryPayload()

  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_NO_SPLIT_RESPONSE)
  await newEntry.fillTitle(payload.title)
  await newEntry.fillSummary(payload.summary)
  await newEntry.selectCategory(payload.category)
  await newEntry.fillDate(payload.entryDate)
  await newEntry.submit()

  await newEntry.waitForDetailRedirect()

  const tone = await detail.waitForTone()
  expect(['POSITIVE', 'NEUTRAL', 'NOTABLE', 'CONCERNING', 'CRITICAL']).toContain(tone)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Multi-event entry: split preview appears → confirm → entries created
//
// Flow: fill multi-event summary → split check returns 2 events (mocked) →
//       SplitPreview modal appears → click "Create separate entries" →
//       PATCH confirm goes to real server → redirect to detail →
//       assert detail shows first event's title from the mock response.
// ─────────────────────────────────────────────────────────────────────────────
test('multi-event entry — split preview → confirm → detail shows first event title', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  const detail = new JournalDetailPage(page)

  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_SPLIT_RESPONSE)
  await newEntry.fillTitle(uniqueTitle('Multi-event'))
  await newEntry.fillSummary(MULTI_EVENT_SUMMARY)
  await newEntry.selectCategory('INCIDENT')
  await newEntry.fillDate(new Date().toISOString().split('T')[0])
  await newEntry.submit()

  await newEntry.waitForSplitPreview()

  // Verify the preview shows both proposed entries.
  await expect(page.getByText('Entry 1')).toBeVisible()
  await expect(page.getByText('Entry 2')).toBeVisible()
  await expect(page.getByText(MOCK_SPLIT_RESPONSE.events[0].title)).toBeVisible()
  await expect(page.getByText(MOCK_SPLIT_RESPONSE.events[1].title)).toBeVisible()

  await newEntry.confirmSplit()
  await newEntry.waitForDetailRedirect()

  // Detail page should reflect the first event's title (PATCH updated the original entry).
  await expect(detail.getTitle()).toContainText(MOCK_SPLIT_RESPONSE.events[0].title)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Multi-event entry: split preview appears → dismiss → single entry preserved
//
// Flow: same as Test 2 up to the preview, then click "Keep as one entry" →
//       PATCH dismiss goes to real server → redirect to detail →
//       assert the ORIGINAL title is preserved (not replaced by split event title).
// ─────────────────────────────────────────────────────────────────────────────
test('multi-event entry — split preview → dismiss → original entry preserved', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  const detail = new JournalDetailPage(page)

  const originalTitle = uniqueTitle('Dismiss test')

  await newEntry.goto()
  await newEntry.mockSplitCheck(MOCK_SPLIT_RESPONSE)
  await newEntry.fillTitle(originalTitle)
  await newEntry.fillSummary(MULTI_EVENT_SUMMARY)
  await newEntry.selectCategory('INCIDENT')
  await newEntry.fillDate(new Date().toISOString().split('T')[0])
  await newEntry.submit()

  await newEntry.waitForSplitPreview()
  await newEntry.dismissSplit()
  await newEntry.waitForDetailRedirect()

  // The entry should still have the original title the Parent typed.
  await expect(detail.getTitle()).toContainText(originalTitle)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Draft entry: enable attachments → finalize → tone evaluates
//
// Flow: fill form → click "Enable Attachments" (creates draft via API) →
//       wait for FileUpload component → submit (PATCHes draft to isDraft:false) →
//       split check returns no-split → redirect to detail → tone appears.
//
// The actual file upload to R2 is skipped — the test verifies the
// draft-create → draft-finalize → ToneEval path without needing real storage.
// ─────────────────────────────────────────────────────────────────────────────
test('draft entry — enable attachments → finalize → tone evaluates', async ({ proPage: page }) => {
  const newEntry = new JournalNewPage(page)
  const detail = new JournalDetailPage(page)

  const payload = buildEntryPayload({ title: uniqueTitle('Draft test') })

  await newEntry.goto()
  // Mock split check BEFORE submitting so the intercept is in place.
  await newEntry.mockSplitCheck(MOCK_NO_SPLIT_RESPONSE)

  // Click "Enable Attachments" BEFORE filling the title. Typing in the title field
  // triggers handleTitleChange → ensureDraft(), which creates a draft and replaces
  // the button with FileUpload before clickEnableAttachments() can run.
  await newEntry.clickEnableAttachments()
  await newEntry.waitForDraftSaved()

  // Fill required fields after the draft is confirmed saved.
  await newEntry.fillTitle(payload.title)
  await newEntry.fillSummary(payload.summary)
  await newEntry.selectCategory(payload.category)
  await newEntry.fillDate(payload.entryDate)

  // Submit — since draftId is now set, the form PATCHes the draft with isDraft:false.
  await newEntry.submit()

  await newEntry.waitForDetailRedirect()

  const tone = await detail.waitForTone()
  expect(['POSITIVE', 'NEUTRAL', 'NOTABLE', 'CONCERNING', 'CRITICAL']).toContain(tone)
})

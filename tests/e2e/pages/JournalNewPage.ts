import type { Page, Route } from '@playwright/test'
import { MOCK_NO_SPLIT_RESPONSE, MOCK_SPLIT_RESPONSE } from '../fixtures/entries'

export class JournalNewPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/journal/new')
    await this.page.waitForLoadState('load')
  }

  async fillTitle(value: string) {
    await this.page.fill('input[name="title"]', value)
  }

  async fillSummary(value: string) {
    await this.page.fill('textarea[name="summary"]', value)
  }

  async fillDate(value: string) {
    await this.page.fill('input[name="entryDate"]', value)
  }

  // Category is the first <select> in the form.
  async selectCategory(value: string) {
    await this.page.locator('select').first().selectOption(value)
  }

  async clickEnableAttachments() {
    await this.page.getByRole('button', { name: /enable attachments/i }).click()
  }

  // Wait for the draft to be saved — the FileUpload "Attach Files" button appears
  // once draftId is set and FileUpload renders, confirming the API call completed.
  async waitForDraftSaved() {
    await this.page.getByRole('button', { name: /attach files/i }).waitFor({ state: 'visible', timeout: 8000 })
  }

  async submit() {
    await this.page.getByRole('button', { name: /save entry/i }).click()
  }

  // Intercept the browser-side split check and return a canned response.
  // The PATCH (confirm/dismiss) is NOT intercepted — it goes to the real server.
  async mockSplitCheck(response: typeof MOCK_SPLIT_RESPONSE | typeof MOCK_NO_SPLIT_RESPONSE) {
    await this.page.route('**/api/entries/*/split', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        })
      } else {
        await route.continue()
      }
    })
  }

  async waitForProcessingFeedback() {
    await this.page.waitForSelector('text=Reading your entry', { timeout: 8000 })
  }

  async waitForSplitPreview() {
    await this.page.waitForSelector('text=This entry covers multiple events', { timeout: 10000 })
  }

  async confirmSplit() {
    await this.page.getByRole('button', { name: /create separate entries/i }).click()
  }

  async dismissSplit() {
    await this.page.getByRole('button', { name: /keep as one entry/i }).click()
  }

  // Wait for navigation to the entry detail page.
  // The negative lookahead (?!new$) prevents a premature match on /journal/new
  // itself, since "new" satisfies [a-z0-9]+.
  async waitForDetailRedirect() {
    await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
  }
}

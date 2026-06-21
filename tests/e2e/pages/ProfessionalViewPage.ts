import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class ProfessionalViewPage {
  constructor(private page: Page) {}

  async goto(entryId: string) {
    await this.page.goto(`/journal/${entryId}`)
    await this.page.waitForLoadState('load')
  }

  async gotoJournal() {
    await this.page.goto('/journal')
    await this.page.waitForLoadState('load')
  }

  async expectNoEditButton() {
    await expect(
      this.page.getByRole('link', { name: /edit entry/i })
    ).not.toBeVisible({ timeout: 5000 })
  }

  async expectNoDeleteButton() {
    await expect(
      this.page.getByRole('button', { name: /remove entry/i })
    ).not.toBeVisible({ timeout: 5000 })
  }

  async expectNoNewEntryButton() {
    await expect(
      this.page.getByRole('link', { name: /new entry/i })
    ).not.toBeVisible({ timeout: 5000 })
  }
}

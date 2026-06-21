import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class MessageAnalysisPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/message-analysis')
    await this.page.waitForLoadState('load')
  }

  // Message Analysis is available to every tier (usage-cap model — ADR-021).
  // Every tier sees the "Analyze Message" button on the list page.
  async expectAnalyzeButtonVisible() {
    await expect(
      this.page.getByRole('link', { name: /analyze message/i }).first()
    ).toBeVisible({ timeout: 5000 })
  }

  // When the monthly cap is hit, the analyze surface shows the calm usage lock.
  async expectUsageCapState() {
    await expect(
      this.page.getByText(/used this period/i).first()
    ).toBeVisible({ timeout: 5000 })
  }
}

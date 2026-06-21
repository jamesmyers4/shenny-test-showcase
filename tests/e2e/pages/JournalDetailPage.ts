import type { Page } from '@playwright/test'

const VALID_TONES = ['POSITIVE', 'NEUTRAL', 'NOTABLE', 'CONCERNING', 'CRITICAL'] as const

export class JournalDetailPage {
  constructor(private page: Page) {}

  getTitle() {
    return this.page.locator('h1').first()
  }

  // Returns the tone badge text — null if still showing "Evaluating".
  async getToneBadgeText(): Promise<string | null> {
    const evaluating = this.page.getByText('Evaluating')
    if (await evaluating.isVisible()) return null

    for (const tone of VALID_TONES) {
      const badge = this.page.getByText(tone, { exact: true })
      if (await badge.isVisible()) return tone
    }
    return null
  }

  // Reloads the page at most `maxAttempts` times until a real Tone badge appears.
  // The detail page is server-rendered — tone shows up only after ToneEval writes to DB.
  async waitForTone(maxAttempts = 10, intervalMs = 1000): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const tone = await this.getToneBadgeText()
      if (tone) return tone
      await this.page.waitForTimeout(intervalMs)
      await this.page.reload()
      await this.page.waitForLoadState('load')
    }
    throw new Error('Tone badge did not appear after polling the detail page')
  }

  async entryId(): Promise<string> {
    const match = this.page.url().match(/\/journal\/([^/?#]+)/)
    return match?.[1] ?? ''
  }
}

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// On Desktop Chrome (≥768px), the ClarityButton floating button is md:hidden.
// The visible compass control is the drawer tab inside ClarityPanel:
//   absolute left-0 -translate-x-full  →  sticks out from the left edge of the panel.
// When the panel is closed (translate-x-full), the tab is visible at the right
// edge of the viewport. aria-label toggles between "Open Clarity" / "Close Clarity".

export class ClarityPage {
  constructor(private page: Page) {}

  // The drawer tab or mobile button — whichever is visible in the current viewport
  private compassButton(label: 'Open Clarity' | 'Close Clarity') {
    return this.page.getByRole('button', { name: label })
  }

  async openPanel() {
    await this.compassButton('Open Clarity').click()
    await this.expectPanelOpen()
  }

  async closePanel() {
    await this.compassButton('Close Clarity').click()
    await this.expectPanelClosed()
  }

  // Panel is open when the drawer tab shows "Close Clarity"
  async expectPanelOpen() {
    await expect(this.compassButton('Close Clarity')).toBeVisible({ timeout: 5000 })
  }

  // Panel is closed when the drawer tab shows "Open Clarity"
  async expectPanelClosed() {
    await expect(this.compassButton('Open Clarity')).toBeVisible({ timeout: 5000 })
  }

  // The compass control is always present on desktop (drawer tab travels with panel).
  // Uses toBeVisible() with retry so it waits for React hydration to complete.
  async expectCompassVisible() {
    await expect(
      this.page.getByRole('button', { name: /^(Open|Close) Clarity$/ })
    ).toBeVisible({ timeout: 15000 })
  }

  // Click "New conversation" in the session list to start a fresh thread
  async startNewSession() {
    await this.page.getByRole('button', { name: 'New conversation' }).click()
    // Wait for thread view to open (textarea appears)
    await this.page.getByPlaceholder('Ask Clarity anything…').waitFor({ state: 'visible', timeout: 5000 })
  }

  // Type message and press Enter to send
  async sendMessage(text: string) {
    const textarea = this.page.getByPlaceholder('Ask Clarity anything…')
    await textarea.fill(text)
    await textarea.press('Enter')
  }

  // Wait for the MOCK_AI response text to appear as an assistant message
  async waitForResponse() {
    // The mock response text is deterministic — wait for any part of it
    await this.page.getByText('Focus on documenting pickup', { exact: false })
      .waitFor({ state: 'visible', timeout: 15000 })
  }

  // Go back to the sessions list view and assert the given title is visible.
  // Uses .first() to avoid strict-mode violations when multiple sessions share the title.
  async expectSessionTitle(title: string) {
    await this.page.getByRole('button', { name: 'Back to conversations' }).click()
    // loadSessions() re-fetches from server — wait for the title to appear
    await this.page.getByText(title, { exact: false }).first().waitFor({ state: 'visible', timeout: 8000 })
  }
}

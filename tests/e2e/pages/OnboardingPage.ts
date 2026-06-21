import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class OnboardingPage {
  constructor(private page: Page) {}

  async navigateTo() {
    await this.page.goto('/onboarding')
    await this.page.waitForLoadState('load')
  }

  // Step 1 — fill preferred name and advance to step 2
  async fillPreferredName(name: string) {
    await this.page.fill('input[placeholder="e.g. Jamie"]', name)
    await this.page.getByRole('button', { name: 'Continue' }).click()
    await expect(this.page.getByText('Who are you co-parenting with?')).toBeVisible({ timeout: 8000 })
  }

  // Step 2 — fill the first co-parent name and advance to step 3
  async fillCoParentName(name: string) {
    await this.page.fill('input[placeholder="e.g. Alex"]', name)
    await this.page.getByRole('button', { name: 'Continue' }).click()
    await expect(this.page.getByText("What are your children's names?")).toBeVisible({ timeout: 8000 })
  }

  // Step 3 — fill the first child name and advance to step 4
  async fillChildName(name: string) {
    await this.page.fill('input[placeholder="e.g. Hudson"]', name)
    await this.page.getByRole('button', { name: 'Continue' }).click()
    await expect(this.page.getByText('Any key witnesses')).toBeVisible({ timeout: 8000 })
  }

  // Step 4 — skip witnesses (no names filled so Skip button is visible)
  async skipWitnesses() {
    await this.page.getByRole('button', { name: 'Skip' }).click()
    await expect(this.page.getByText('Tell Shenny about your situation.')).toBeVisible({ timeout: 8000 })
  }

  // Step 5 — skip situation context (textarea empty so Skip button is visible)
  async skipSituationContext() {
    await this.page.getByRole('button', { name: 'Skip' }).click()
    await this.expectCompletionScreen()
  }

  // Run steps 1-3 with required fields, skip steps 4 and 5
  async completeFlow(preferredName: string, coParentName: string, childName: string) {
    await this.fillPreferredName(preferredName)
    await this.fillCoParentName(coParentName)
    await this.fillChildName(childName)
    await this.skipWitnesses()
    await this.skipSituationContext()
  }

  async expectCompletionScreen() {
    await expect(this.page.getByText("You're all set", { exact: false })).toBeVisible({ timeout: 10000 })
  }
}

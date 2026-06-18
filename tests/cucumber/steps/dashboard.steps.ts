import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

When('I navigate to the dashboard', async function (this: CustomWorld) {
  await this.page.goto('/dashboard')
  await this.page.waitForLoadState('load')
})

Then('the dashboard should have a primary heading', async function (this: CustomWorld) {
  await expect(this.page.locator('h1').first()).toBeVisible({ timeout: 5000 })
})

Then(
  'I should see the sidebar plan badge showing {string}',
  async function (this: CustomWorld, tier: string) {
    await expect(this.page.getByText(tier, { exact: true }).first()).toBeVisible({ timeout: 5000 })
  }
)

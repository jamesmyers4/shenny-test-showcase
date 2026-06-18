import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

When('I visit the Message Analysis page', async function (this: CustomWorld) {
  await this.page.goto('/message-analysis')
  await this.page.waitForLoadState('load')
})

Then('I should see the Analyze Message button', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('link', { name: /analyze message/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

Then('the Message Analysis nav link should have exactly one icon', async function (this: CustomWorld) {
  const navLink = this.page.locator('a[href="/message-analysis"]')
  await expect(navLink).toBeVisible({ timeout: 5000 })
  await expect(navLink.locator('svg')).toHaveCount(1)
})

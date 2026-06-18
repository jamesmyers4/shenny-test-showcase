import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

type SettingsWorld = CustomWorld & {
  _stripeCheckoutCalled?: boolean
}

When('I navigate to the settings page', async function (this: CustomWorld) {
  await this.page.goto('/settings')
  await this.page.waitForLoadState('load')
})

When('I navigate to the plans settings page', async function (this: CustomWorld) {
  await this.page.goto('/settings/plans')
  await this.page.waitForLoadState('load')
})

Then('I should see the manage plan link', async function (this: CustomWorld) {
  await expect(
    this.page
      .getByRole('link', { name: /manage|billing|upgrade|plans/i })
      .first()
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see the danger zone section', async function (this: CustomWorld) {
  await expect(this.page.getByText(/danger zone/i).first()).toBeVisible({ timeout: 5000 })
})

Then('the delete account button should be disabled', async function (this: CustomWorld) {
  const btn = this.page.getByRole('button', { name: /delete my account/i })
  await expect(btn).toBeVisible({ timeout: 5000 })
  await expect(btn).toBeDisabled()
})

When('I type the delete confirmation word', async function (this: CustomWorld) {
  const input = this.page
    .locator('input[placeholder*="DELETE"]')
    .or(this.page.locator('input[aria-label*="Type DELETE"]'))
    .or(this.page.locator('input[aria-label*="DELETE"]'))
    .first()
  await input.fill('DELETE')
})

Then('the delete account button should be enabled', async function (this: CustomWorld) {
  const btn = this.page.getByRole('button', { name: /delete my account/i })
  await expect(btn).toBeEnabled({ timeout: 5000 })
})

When('the delete user endpoint is mocked', async function (this: CustomWorld) {
  await this.page.route('**/api/user/delete', (route) => {
    if (route.request().method() === 'DELETE') {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scheduled: true,
          deletionDate: '2026-06-22T00:00:00.000Z',
        }),
      })
    } else {
      void route.continue()
    }
  })
})

When('I click the delete account button', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /delete my account/i }).click()
  await this.page.waitForTimeout(500)
})

Then('I should see the account deletion scheduled message', async function (this: CustomWorld) {
  await expect(this.page.getByText(/30 days/i)).toBeVisible({ timeout: 5000 })
})

Then('the annual billing option should be pre-selected', async function (this: CustomWorld) {
  const annualBtn = this.page.getByRole('button', { name: /annual/i })
  await expect(annualBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
})

Then(
  'I should see Standard and Premium plan options with pricing',
  async function (this: CustomWorld) {
    await expect(
      this.page.getByRole('button', { name: /choose standard/i }).first()
    ).toBeVisible({ timeout: 5000 })
    await expect(
      this.page.getByRole('button', { name: /choose premium/i }).first()
    ).toBeVisible({ timeout: 5000 })
  }
)

When('the Stripe checkout endpoint is mocked', async function (this: CustomWorld) {
  const world = this as SettingsWorld
  world._stripeCheckoutCalled = false
  await this.page.route('**/api/stripe/checkout', (route) => {
    if (route.request().method() === 'POST') {
      world._stripeCheckoutCalled = true
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/test' }),
      })
    } else {
      void route.continue()
    }
  })
  await this.page.route('https://checkout.stripe.com/**', (route) => void route.abort())
})

When('I click the upgrade button on the plans page', async function (this: CustomWorld) {
  const btn = this.page
    .getByRole('button', { name: /choose standard|choose premium/i })
    .first()
  await expect(btn).toBeVisible({ timeout: 5000 })
  await btn.click()
  await this.page.waitForTimeout(500)
})

Then(
  'the Stripe checkout endpoint should have been called',
  async function (this: CustomWorld) {
    const world = this as SettingsWorld
    expect(world._stripeCheckoutCalled).toBe(true)
  }
)

import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { setUserTier, setUserPlan } from '../../e2e/helpers/db.ts'
import { CustomWorld } from '../support/world'

const CLERK_ID = () => process.env.E2E_CLERK_USER_ID!

After({ tags: '@regression' }, async function (this: CustomWorld) {
  try {
    await setUserPlan(CLERK_ID(), 'FREE')
  } catch {
    // Ignore cleanup errors
  }
})

Given('I am a FREE plan user', async function (this: CustomWorld) {
  await setUserTier(CLERK_ID(), 'FREE', { hasEverSubscribed: false })
})

Given('I am a PREMIUM plan user', async function (this: CustomWorld) {
  await setUserTier(CLERK_ID(), 'PREMIUM', {
    subscriptionStatus: 'active',
    hasEverSubscribed: true,
  })
})

When('I navigate to the billing plans page', async function (this: CustomWorld) {
  await this.page.goto('/settings/plans')
  await this.page.waitForLoadState('load')
})

When('I navigate to the billing plans page with {string}', async function (this: CustomWorld, query: string) {
  await this.page.goto(`/settings/plans?${query}`)
  await this.page.waitForLoadState('load')
})

Then('I should see the Free Standard and Premium tier cards', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('heading', { name: /^free$/i }).first()
  ).toBeVisible({ timeout: 5000 })
  await expect(
    this.page.getByRole('button', { name: /choose standard/i }).first()
  ).toBeVisible({ timeout: 5000 })
  await expect(
    this.page.getByRole('button', { name: /choose premium/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see current period usage information', async function (this: CustomWorld) {
  await expect(this.page.getByText(/this period/i).first()).toBeVisible({ timeout: 5000 })
})

Then('I should see a top-up entry point', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('button', { name: /add more/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see the subscription success banner', async function (this: CustomWorld) {
  await expect(this.page.getByText(/your updated limits are active/i)).toBeVisible({ timeout: 5000 })
})

Then('I should see the no-change note', async function (this: CustomWorld) {
  await expect(this.page.getByText(/no worries.*nothing changed/i)).toBeVisible({ timeout: 5000 })
})

Then('the annual billing toggle should be pre-selected', async function (this: CustomWorld) {
  const annualBtn = this.page.getByRole('button', { name: /annual/i })
  await expect(annualBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
})

When('I navigate to the message analysis analyze page', async function (this: CustomWorld) {
  await this.page.goto('/message-analysis/analyze')
  await this.page.waitForLoadState('load')
})

Then('I should see the paid-feature upgrade lock', async function (this: CustomWorld) {
  await expect(
    this.page.getByText(/part of a paid plan/i).first()
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see the see plans link', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('link', { name: /see plans/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

When('I navigate to the cases page', async function (this: CustomWorld) {
  await this.page.goto('/cases')
  await this.page.waitForLoadState('load')
})

Then('I should see the Cases upgrade state', async function (this: CustomWorld) {
  await expect(
    this.page.getByText(/cases are part of a paid plan/i)
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see the see plans link on the cases page', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('link', { name: /see plans/i })
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see the Clarity button', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('button', { name: /clarity/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

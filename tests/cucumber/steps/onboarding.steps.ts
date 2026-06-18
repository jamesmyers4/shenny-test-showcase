import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { setUserOnboarding } from '../../e2e/helpers/db.ts'
import { CustomWorld } from '../support/world'

const CLERK_ID = () => process.env.E2E_CLERK_USER_ID!

After({ tags: '@onboarding' }, async function (this: CustomWorld) {
  try {
    await setUserOnboarding(CLERK_ID(), {
      isOnboardingComplete: true,
      onboardingStep: 5,
      preferredName: 'E2E Parent',
      coParentNames: ['E2E CoParent'],
      childrenNames: ['E2E Child'],
    })
  } catch {
    // Ignore cleanup errors
  }
})

Given('my onboarding is not complete', async function (this: CustomWorld) {
  await setUserOnboarding(CLERK_ID(), { isOnboardingComplete: false, onboardingStep: 0 })
})

Given('my onboarding is at step {int}', async function (this: CustomWorld, step: number) {
  await setUserOnboarding(CLERK_ID(), { isOnboardingComplete: false, onboardingStep: step })
})

When('I navigate to the onboarding page', async function (this: CustomWorld) {
  await this.page.goto('/onboarding')
  await this.page.waitForLoadState('load')
})

When('I complete the onboarding flow', async function (this: CustomWorld) {
  const preferredName = 'E2E Parent'
  const coParentName = 'E2E CoParent'
  const childName = 'E2E Child'

  // Step 1 — preferred name
  const nameInput = this.page.locator('input').first()
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })
  await nameInput.fill(preferredName)
  await this.page.getByRole('button', { name: /next|continue/i }).first().click()

  // Step 2 — co-parent name
  await this.page.waitForTimeout(500)
  const coParentInput = this.page.locator('input').first()
  await coParentInput.fill(coParentName)
  await this.page.getByRole('button', { name: /next|continue/i }).first().click()

  // Step 3 — children names
  await this.page.waitForTimeout(500)
  const childInput = this.page.locator('input').first()
  await childInput.fill(childName)
  await this.page.getByRole('button', { name: /next|continue|done|finish/i }).first().click()

  // Steps 4 and 5 — optional; skip if skip buttons are present
  for (let i = 0; i < 2; i++) {
    await this.page.waitForTimeout(500)
    const skipBtn = this.page.getByRole('button', { name: /skip/i }).first()
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click()
    }
  }
})

Then('I should see the completion screen', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('button', { name: /create your first entry/i })
  ).toBeVisible({ timeout: 15000 })
})

When('I click Create your first entry', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /create your first entry/i }).click()
})

Then('I should be on the new Entry page', async function (this: CustomWorld) {
  await this.page.waitForURL(/\/journal\/new/, { timeout: 15000 })
  expect(this.page.url()).toContain('/journal/new')
})

When('I navigate to the journal page directly', async function (this: CustomWorld) {
  await this.page.goto('/journal')
  await this.page.waitForLoadState('load')
})

Then('I should be redirected to the onboarding page', async function (this: CustomWorld) {
  await this.page.waitForURL(/\/onboarding/, { timeout: 8000 })
  expect(this.page.url()).toContain('/onboarding')
})

Then("I should see the children names step", async function (this: CustomWorld) {
  await expect(
    this.page.getByText(/what are your children.s names/i)
  ).toBeVisible({ timeout: 8000 })
})

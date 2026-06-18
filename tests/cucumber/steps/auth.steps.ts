import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'
import { CustomWorld } from '../support/world'

Given('I am logged in as the test Parent', async function (this: CustomWorld) {
  await setupClerkTestingToken({ page: this.page })
  await this.page.goto('/')
  await clerk.signIn({ page: this.page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! })
  await this.page.evaluate(() => localStorage.setItem('app_mfa_nag_dismissed', '1'))
})

Given('I navigate to the sign-in page', async function (this: CustomWorld) {
  await this.page.goto('/sign-in')
  await this.page.waitForLoadState('load')
})

When('I complete the Clerk sign-in flow as the test Parent', async function (this: CustomWorld) {
  await setupClerkTestingToken({ page: this.page })
  await clerk.signIn({ page: this.page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! })
  await this.page.evaluate(() => localStorage.setItem('app_mfa_nag_dismissed', '1'))
})

Then('I should land on the journal page', async function (this: CustomWorld) {
  await this.page.goto('/journal')
  await this.page.waitForLoadState('load')
  await expect(this.page).toHaveURL(/\/journal/)
})

When('I visit the journal page', async function (this: CustomWorld) {
  await this.page.goto('/journal')
  await this.page.waitForLoadState('load')
})

Then('the MFA nag banner should not be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByText('Protect your records', { exact: false })
  ).not.toBeVisible({ timeout: 3000 })
})

Given('I am not signed in', function (this: CustomWorld) {
  // Fresh browser context — no Clerk session
})

Then('I should be redirected to sign-in', async function (this: CustomWorld) {
  await expect(this.page).toHaveURL(/\/sign-in/, { timeout: 8000 })
})

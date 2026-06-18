import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { setUserReadOnly, deleteTestEntry } from '../../e2e/helpers/db.ts'
import { CustomWorld } from '../support/world'

const CLERK_ID = () => process.env.E2E_CLERK_USER_ID!

After({ tags: '@regression' }, async function (this: CustomWorld) {
  // Ensure read-only mode is always restored after each scenario in this step file.
  // This is a safety net; individual steps also restore as needed.
  try {
    await setUserReadOnly(CLERK_ID(), false)
  } catch {
    // Ignore cleanup errors — DB may already be in normal state
  }
})

Given('my account is set to read-only mode', async function (this: CustomWorld) {
  await setUserReadOnly(CLERK_ID(), true)
})

Given('my account is in normal mode', async function (this: CustomWorld) {
  await setUserReadOnly(CLERK_ID(), false)
})

When('I navigate to the new Entry page', async function (this: CustomWorld) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
})

Then('I should be redirected to the journal', async function (this: CustomWorld) {
  expect(this.page.url()).toContain('/journal')
  expect(this.page.url()).not.toContain('/journal/new')
  await setUserReadOnly(CLERK_ID(), false)
})

Then('the edit Entry button should not be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('link', { name: /edit entry/i })
  ).not.toBeVisible({ timeout: 5000 })
})

Then('the delete Entry button should not be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('button', { name: /delete/i })
  ).not.toBeVisible({ timeout: 5000 })
  await setUserReadOnly(CLERK_ID(), false)
  if (this.lastCreatedEntryId) {
    await deleteTestEntry(this.lastCreatedEntryId)
    this.lastCreatedEntryId = null
  }
})

Then('the new Entry button should not be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('link', { name: /new entry/i })
  ).not.toBeVisible({ timeout: 5000 })
  await setUserReadOnly(CLERK_ID(), false)
})

Then('the edit Entry button should be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('link', { name: /edit entry/i })
  ).toBeVisible({ timeout: 5000 })
  if (this.lastCreatedEntryId) {
    await deleteTestEntry(this.lastCreatedEntryId)
    this.lastCreatedEntryId = null
  }
})

import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

const MOCK_CLARITY_RESPONSE =
  'Focus on documenting pickup and drop-off times consistently, including any deviations from the agreed parenting plan.'
const MOCK_CLARITY_SESSION_TITLE = 'Documentation priorities'

When('I visit the new Entry page', async function (this: CustomWorld) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
})

When('I visit that Entry\'s detail page', async function (this: CustomWorld) {
  if (!this.lastCreatedEntryId) throw new Error('No entry ID in world state')
  await this.page.goto(`/journal/${this.lastCreatedEntryId}`)
  await this.page.waitForLoadState('load')
})

Then('the Clarity compass button should be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('button', { name: /^(Open|Close) Clarity$/ })
  ).toBeVisible({ timeout: 15000 })
})

When('I open the Clarity panel', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: 'Open Clarity' }).click()
  await expect(this.page.getByRole('button', { name: 'Close Clarity' })).toBeVisible({ timeout: 5000 })
})

Then('the Clarity panel should be open', async function (this: CustomWorld) {
  await expect(this.page.getByRole('button', { name: 'Close Clarity' })).toBeVisible({ timeout: 5000 })
})

When('I close the Clarity panel', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: 'Close Clarity' }).click()
  await expect(this.page.getByRole('button', { name: 'Open Clarity' })).toBeVisible({ timeout: 5000 })
})

Then('the Clarity panel should be closed', async function (this: CustomWorld) {
  await expect(this.page.getByRole('button', { name: 'Open Clarity' })).toBeVisible({ timeout: 5000 })
})

When('I start a new Clarity session', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: 'New conversation' }).click()
  await this.page
    .getByPlaceholder('Ask Clarity anything…')
    .waitFor({ state: 'visible', timeout: 5000 })
})

When('I send the Clarity message {string}', async function (this: CustomWorld, message: string) {
  const textarea = this.page.getByPlaceholder('Ask Clarity anything…')
  await textarea.fill(message)
  await textarea.press('Enter')
})

Then('I should see a response from the Clarity assistant', async function (this: CustomWorld) {
  await this.page
    .getByText('Focus on documenting pickup', { exact: false })
    .waitFor({ state: 'visible', timeout: 15000 })
  await expect(
    this.page.getByText(MOCK_CLARITY_RESPONSE, { exact: false })
  ).toBeVisible()
})

Then('the Clarity session title should be generated', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: 'Back to conversations' }).click()
  await this.page
    .getByText(MOCK_CLARITY_SESSION_TITLE, { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
})


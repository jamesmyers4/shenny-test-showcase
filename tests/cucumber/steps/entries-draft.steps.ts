import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { CustomWorld } from '../support/world'

const MOCK_NO_SPLIT = { shouldSplit: false }

async function mockSplitCheck(world: CustomWorld) {
  await world.page.route('**/api/entries/*/split', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_NO_SPLIT),
      })
    } else {
      await route.continue()
    }
  })
}

Given('I am on the new Entry form', async function (this: CustomWorld) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
})

When('I create a new Entry via the draft flow with attachments enabled', async function (this: CustomWorld) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
  await mockSplitCheck(this)

  await this.page.getByRole('button', { name: /enable attachments/i }).click()
  await this.page.getByRole('button', { name: /attach files/i }).waitFor({ state: 'visible', timeout: 8000 })

  const title = `E2E Draft Entry ${faker.string.alphanumeric(8)}`
  await this.page.fill('input[name="title"]', title)
  await this.page.fill('textarea[name="summary"]', 'At the 3:15 PM school pickup Hudson appeared unusually tired.')
  await this.page.locator('select').first().selectOption('INCIDENT')
  await this.page.fill('input[name="entryDate"]', new Date().toISOString().split('T')[0])
  await this.page.getByRole('button', { name: /save entry/i }).click()
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
})

Then('the source picker should contain {string}', async function (this: CustomWorld, option: string) {
  const sourceSelect = this.page.locator('select').nth(1)
  const options = await sourceSelect.locator('option').allTextContents()
  expect(options).toContain(option)
})

Then('the source picker should not contain {string}', async function (this: CustomWorld, option: string) {
  const sourceSelect = this.page.locator('select').nth(1)
  const options = await sourceSelect.locator('option').allTextContents()
  expect(options).not.toContain(option)
})

Then('the category picker should contain {string}', async function (this: CustomWorld, option: string) {
  const categorySelect = this.page.locator('select').first()
  const options = await categorySelect.locator('option').allTextContents()
  expect(options).toContain(option)
})

Then('the eventTime input field should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByPlaceholder(/around 3pm/i)).toBeVisible()
})

When('I create a new Entry with an empty eventTime field', async function (this: CustomWorld) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
  await mockSplitCheck(this)

  const title = `E2E EventTime Empty ${faker.string.alphanumeric(8)}`
  await this.page.fill('input[name="title"]', title)
  await this.page.fill('textarea[name="summary"]', 'Testing empty eventTime submission.')
  await this.page.locator('select').first().selectOption('INCIDENT')
  await this.page.fill('input[name="entryDate"]', new Date().toISOString().split('T')[0])
  await this.page.getByRole('button', { name: /save entry/i }).click()
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
})

When('I create a new Entry with eventTime {string}', async function (this: CustomWorld, eventTime: string) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
  await mockSplitCheck(this)

  const title = `E2E EventTime ${faker.string.alphanumeric(8)}`
  await this.page.fill('input[name="title"]', title)
  await this.page.fill('textarea[name="summary"]', 'Testing eventTime display on detail page.')
  await this.page.locator('select').first().selectOption('INCIDENT')
  await this.page.fill('input[name="entryDate"]', new Date().toISOString().split('T')[0])
  await this.page.fill('input[placeholder*="around 3pm"]', eventTime)
  await this.page.getByRole('button', { name: /save entry/i }).click()
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
})

Then('the time {string} should be visible on the detail page', async function (this: CustomWorld, timeText: string) {
  await expect(this.page.getByText(timeText)).toBeVisible()
})

import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { CustomWorld } from '../support/world'

const MOCK_NO_SPLIT = { shouldSplit: false }

Given('I am on the exports page', async function (this: CustomWorld) {
  await this.page.goto('/exports')
  await this.page.waitForLoadState('load')
})

Then('the import drop zone should be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByText('Drop your spreadsheet here or click to browse', { exact: false })
  ).toBeVisible({ timeout: 5000 })
})

Then('the import helper text should be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByText('App will map your columns automatically', { exact: false })
  ).toBeVisible({ timeout: 5000 })
})

Given('I have at least one Entry in my journal', async function (this: CustomWorld) {
  await this.page.route('**/api/entries/*/split', async (route) => {
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

  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
  const title = `E2E Pagination Seed ${faker.string.alphanumeric(8)}`
  await this.page.fill('input[name="title"]', title)
  await this.page.fill('textarea[name="summary"]', 'Seeded entry for pagination testing.')
  await this.page.locator('select').first().selectOption('INCIDENT')
  await this.page.fill('input[name="entryDate"]', new Date().toISOString().split('T')[0])
  await this.page.getByRole('button', { name: /save entry/i }).click()
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
})

Then('I should see page size options for 10, 25, 50, 100, and All', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('page-size-10')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-25')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-50')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-100')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-all')).toBeVisible({ timeout: 5000 })
})

When('I select page size {int}', async function (this: CustomWorld, size: number) {
  await this.page.getByTestId(`page-size-${size}`).click()
  await this.page.waitForURL(new RegExp(`pageSize=${size}`), { timeout: 5000 })
})

When('I select All page size', async function (this: CustomWorld) {
  await this.page.getByTestId('page-size-all').click()
  await this.page.waitForURL(/pageSize=0/, { timeout: 5000 })
})

Then('the URL should contain {string}', async function (this: CustomWorld, fragment: string) {
  expect(this.page.url()).toContain(fragment)
})

Then('I should see a showing-all count message', async function (this: CustomWorld) {
  await expect(this.page.getByText(/Showing all/)).toBeVisible({ timeout: 5000 })
})

When('I visit the journal page with page size {int}', async function (this: CustomWorld, size: number) {
  await this.page.goto(`/journal?pageSize=${size}`)
  await this.page.waitForLoadState('load')
})

Then('the page size {int} button should be active', async function (this: CustomWorld, size: number) {
  const btn = this.page.getByTestId(`page-size-${size}`)
  await expect(btn).toBeVisible({ timeout: 5000 })
  await expect(btn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
})

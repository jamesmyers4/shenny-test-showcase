import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

Given('I am on the {string} page', async function (this: CustomWorld, path: string) {
  const url = path.startsWith('/') ? path : `/${path}`
  await this.page.goto(url)
  await this.page.waitForLoadState('load')
})

Then('I should be redirected to {string}', async function (this: CustomWorld, path: string) {
  await expect(this.page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
    timeout: 8000,
  })
})

Then('I should see a {string} error message', async function (this: CustomWorld, message: string) {
  await expect(this.page.getByText(message, { exact: false })).toBeVisible({ timeout: 5000 })
})

Then('the journal heading should be visible', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('heading', { name: /journal/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

Then('the page size selector should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('page-size-10')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-25')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-50')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-100')).toBeVisible({ timeout: 5000 })
  await expect(this.page.getByTestId('page-size-all')).toBeVisible({ timeout: 5000 })
})

// When I select page size {int}  → defined in entries-import.steps.ts
// Then the URL should contain {string} → defined in entries-import.steps.ts

When('I select page size all', async function (this: CustomWorld) {
  await this.page.getByTestId('page-size-all').click()
  await this.page.waitForURL(/pageSize=0/, { timeout: 5000 })
})

Then('I should see {string} on the page', async function (this: CustomWorld, text: string) {
  await expect(this.page.getByText(text, { exact: false })).toBeVisible({ timeout: 5000 })
})

Then('the {string} page size button should be highlighted', async function (this: CustomWorld, size: string) {
  const btn = this.page.getByTestId(`page-size-${size}`)
  await expect(btn).toBeVisible({ timeout: 5000 })
  await expect(btn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
})

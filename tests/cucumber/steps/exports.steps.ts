import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

type ExportWorld = CustomWorld & {
  _exportCalled?: boolean
  _exportRequestBody?: Record<string, unknown>
}

When('I navigate to the exports page', async function (this: CustomWorld) {
  await this.page.goto('/exports')
  await this.page.waitForLoadState('load')
})

Then('I should see the Start Date optional label', async function (this: CustomWorld) {
  await expect(this.page.getByText('Start Date (optional)')).toBeVisible({ timeout: 5000 })
})

Then('I should see the End Date optional label', async function (this: CustomWorld) {
  await expect(this.page.getByText('End Date (optional)')).toBeVisible({ timeout: 5000 })
})

Then('I should see the Export All button', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('export-all-button')).toBeVisible({ timeout: 5000 })
})

Then(
  'I should see the export helper text containing {string}',
  async function (this: CustomWorld, text: string) {
    await expect(this.page.getByTestId('export-helper-text')).toBeVisible({ timeout: 5000 })
    await expect(this.page.getByTestId('export-helper-text')).toContainText(text)
  }
)

When('the export API is mocked', async function (this: CustomWorld) {
  const world = this as ExportWorld
  world._exportCalled = false
  world._exportRequestBody = {}
  await this.page.route('**/api/export', (route) => {
    if (route.request().method() === 'POST') {
      world._exportCalled = true
      const body = route.request().postDataJSON() as Record<string, unknown>
      world._exportRequestBody = body
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://r2.test/export.xlsx', exportId: 'test-export-id' }),
      })
    } else {
      void route.continue()
    }
  })
  // Block window.open so navigation doesn't leave the page
  await this.page.addInitScript(() => {
    window.open = () => null
  })
})

When('the export API is mocked with a delay', async function (this: CustomWorld) {
  await this.page.route('**/api/export', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((r) => setTimeout(r, 300))
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://r2.test/export.xlsx', exportId: 'test-export-id' }),
      })
    } else {
      void route.continue()
    }
  })
})

When('I click the Export All button', async function (this: CustomWorld) {
  await this.page.getByTestId('export-all-button').click()
  await this.page.waitForTimeout(500)
})

When('I click the export submit button', async function (this: CustomWorld) {
  await this.page.getByTestId('export-submit').click()
})

Then('the export API should be called without date filters', async function (this: CustomWorld) {
  const world = this as ExportWorld
  expect(world._exportCalled).toBe(true)
  expect(world._exportRequestBody?.filters).toBeUndefined()
})

Then('the export API should be called', async function (this: CustomWorld) {
  const world = this as ExportWorld
  expect(world._exportCalled).toBe(true)
})

Then('the XLSX format option should be pre-selected', async function (this: CustomWorld) {
  const xlsxBtn = this.page.getByTestId('format-xlsx')
  await expect(xlsxBtn).toBeVisible({ timeout: 5000 })
  await expect(xlsxBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
})

Then('I should see the building your export message', async function (this: CustomWorld) {
  await expect(this.page.getByText('Building your export…')).toBeVisible({ timeout: 2000 })
})

Then('I should see the export download link', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('export-download-link')).toBeVisible({ timeout: 5000 })
})

import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

When(
  'I request the {string} endpoint without a secret',
  async function (this: CustomWorld, path: string) {
    const response = await this.page.request.get(`${this.baseUrl}${path}`)
    this.lastResponseStatus = response.status()
  }
)

Then('the response status should be {int}', async function (this: CustomWorld, status: number) {
  expect(this.lastResponseStatus).toBe(status)
})

When('I visit the path {string}', async function (this: CustomWorld, path: string) {
  await this.page.goto(path)
  await this.page.waitForLoadState('load')
})

Then('the sign-in form should be visible', async function (this: CustomWorld) {
  await expect(this.page.locator('form').first()).toBeVisible({ timeout: 5000 })
})

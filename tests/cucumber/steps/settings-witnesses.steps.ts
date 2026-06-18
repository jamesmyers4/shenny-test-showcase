import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

type WitnessWorld = CustomWorld & {
  _witnessSaveConfirmed?: boolean
}

When('I click the add known witness button', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /add known witness/i }).click()
})

Then('I should see the Known Witnesses section', async function (this: CustomWorld) {
  await expect(this.page.getByText('Known Witnesses')).toBeVisible({ timeout: 5000 })
})

Then('I should see the add known witness button', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('button', { name: /add known witness/i })
  ).toBeVisible({ timeout: 5000 })
})

Then('I should see the witness name field', async function (this: CustomWorld) {
  await expect(this.page.locator('[aria-label="Witness name"]')).toBeVisible({ timeout: 5000 })
})

Then('I should see the witness role field', async function (this: CustomWorld) {
  await expect(this.page.locator('[aria-label="Witness role"]')).toBeVisible({ timeout: 5000 })
})

When(
  'the stored witnesses endpoint is mocked for adding',
  async function (this: CustomWorld) {
    await this.page.route('**/api/stored-witnesses', (route) => {
      if (route.request().method() === 'POST') {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'test-witness-id',
              name: 'Dr. Amy Proulx',
              role: 'child psychologist',
              notes: null,
            },
          }),
        })
      } else {
        void route.continue()
      }
    })
  }
)

When(
  'I fill in the witness name {string}',
  async function (this: CustomWorld, name: string) {
    await this.page.locator('[aria-label="Witness name"]').fill(name)
  }
)

When(
  'I fill in the witness role {string}',
  async function (this: CustomWorld, role: string) {
    await this.page.locator('[aria-label="Witness role"]').fill(role)
  }
)

When('I submit the witness form', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /^add$/i }).click()
  await this.page.waitForTimeout(500)
})

Then('the witness save confirmation should be shown', async function (this: CustomWorld) {
  await expect(
    this.page.getByText(/saved/i).first()
  ).toBeVisible({ timeout: 5000 })
})

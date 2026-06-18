import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { CustomWorld } from '../support/world'

const MOCK_NO_SPLIT = { shouldSplit: false }
const MOCK_SPLIT = {
  shouldSplit: true,
  events: [
    {
      title: 'Playground injury not communicated at pickup',
      narrative: 'At 3:15 PM teacher Mrs. Johnson informed me of a playground injury.',
      category: 'MEDICAL',
      suggestedTone: 'NOTABLE',
    },
    {
      title: 'Father 45 minutes late to exchange — no notice',
      narrative: 'At 4:30 PM father was 45 minutes late to the agreed pickup location.',
      category: 'SCHEDULE',
      suggestedTone: 'CONCERNING',
    },
  ],
}

const MULTI_EVENT_SUMMARY =
  'At 3:15 PM I arrived at school to pick up Hudson. ' +
  'The teacher Mrs. Johnson told me Hudson had fallen on the playground at 1:00 PM and ' +
  'injured his knee. She showed me the bruise and noted it in the incident log. ' +
  'Then at 4:30 PM when I arrived at the agreed pickup location to return Hudson to his father, ' +
  'his father was 45 minutes late with no prior notice or communication of any kind.'

async function mockSplitCheck(
  world: CustomWorld,
  response: typeof MOCK_SPLIT | typeof MOCK_NO_SPLIT
) {
  await world.page.route('**/api/entries/*/split', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    } else {
      await route.continue()
    }
  })
}

async function fillAndSubmitEntry(world: CustomWorld, title: string, summary: string) {
  await world.page.goto('/journal/new')
  await world.page.waitForLoadState('load')
  await world.page.fill('input[name="title"]', title)
  await world.page.fill('textarea[name="summary"]', summary)
  await world.page.locator('select').first().selectOption('INCIDENT')
  await world.page.fill('input[name="entryDate"]', new Date().toISOString().split('T')[0])
  await world.page.getByRole('button', { name: /save entry/i }).click()
}

Given('I have an existing Entry', async function (this: CustomWorld) {
  await mockSplitCheck(this, MOCK_NO_SPLIT)
  const title = `E2E Existing Entry ${faker.string.alphanumeric(8)}`
  await fillAndSubmitEntry(this, title, 'Test entry for scenario setup.')
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
  const match = this.page.url().match(/\/journal\/([^/?#]+)/)
  this.lastCreatedEntryId = match?.[1] ?? null
})

When('I create a new Entry', async function (this: CustomWorld) {
  const title = `E2E Entry ${faker.string.alphanumeric(8)}`
  await mockSplitCheck(this, MOCK_NO_SPLIT)
  await fillAndSubmitEntry(this, title, 'At the 3:15 PM school pickup Hudson appeared unusually tired.')
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
  const match = this.page.url().match(/\/journal\/([^/?#]+)/)
  this.lastCreatedEntryId = match?.[1] ?? null
})

When('I create a new multi-event Entry', async function (this: CustomWorld) {
  const title = `E2E Multi-event ${faker.string.alphanumeric(8)}`
  await mockSplitCheck(this, MOCK_SPLIT)
  await fillAndSubmitEntry(this, title, MULTI_EVENT_SUMMARY)
})

When('I create a new Entry titled {string} with a multi-event summary', async function (this: CustomWorld, title: string) {
  const uniqueTitle = `${title} ${faker.string.alphanumeric(6)}`
  await mockSplitCheck(this, MOCK_SPLIT)
  await fillAndSubmitEntry(this, uniqueTitle, MULTI_EVENT_SUMMARY)
  this.lastCreatedEntryId = uniqueTitle
})

Then('I should be on the Entry detail page', async function (this: CustomWorld) {
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
  await expect(this.page).toHaveURL(/\/journal\/(?!new$)[a-z0-9]+$/)
})

Then('a tone badge should be visible', async function (this: CustomWorld) {
  const toneBlock = this.page
    .getByText('Evaluating')
    .or(
      this.page
        .locator('span')
        .filter({ hasText: /^(POSITIVE|NEUTRAL|NOTABLE|CONCERNING|CRITICAL)$/ })
    )
  await expect(toneBlock.first()).toBeVisible({ timeout: 5000 })
})

Then('I should see the split preview modal', async function (this: CustomWorld) {
  await this.page.waitForSelector('text=This entry covers multiple events', { timeout: 10000 })
})

When('I confirm the split', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /create separate entries/i }).click()
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
  const match = this.page.url().match(/\/journal\/([^/?#]+)/)
  this.lastCreatedEntryId = match?.[1] ?? null
})

When('I dismiss the split', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /keep as one entry/i }).click()
  await this.page.waitForURL(/\/journal\/(?!new$)[a-z0-9]+$/, { timeout: 15000 })
})

Then('the Entry title should match the first proposed split event', async function (this: CustomWorld) {
  await expect(this.page.locator('h1').first()).toContainText(
    'Playground injury not communicated at pickup'
  )
})

Then('the Entry title should contain {string}', async function (this: CustomWorld, text: string) {
  await expect(this.page.locator('h1').first()).toContainText(text)
})

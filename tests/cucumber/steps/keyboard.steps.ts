import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CustomWorld } from '../support/world'

When('I navigate to the journal page for keyboard testing', async function (this: CustomWorld) {
  await this.page.goto('/journal')
  await this.page.waitForLoadState('load')
})

When('I navigate to the new entry page for keyboard testing', async function (this: CustomWorld) {
  await this.page.goto('/journal/new')
  await this.page.waitForLoadState('load')
})

When('I press Tab once', async function (this: CustomWorld) {
  await this.page.keyboard.press('Tab')
})

When('I press Enter', async function (this: CustomWorld) {
  await this.page.keyboard.press('Enter')
})

Then(
  'the focused element should read {string}',
  async function (this: CustomWorld, expectedText: string) {
    const focused = await this.page.evaluate(
      () => document.activeElement?.textContent?.trim()
    )
    expect(focused).toBe(expectedText)
  }
)

Then('focus should be on the main content element', async function (this: CustomWorld) {
  const focusedId = await this.page.evaluate(() => document.activeElement?.id)
  expect(focusedId).toBe('main-content')
})

Then(
  'the sidebar navigation should be reachable within 15 Tab presses',
  async function (this: CustomWorld) {
    let found = false
    for (let i = 0; i < 15; i++) {
      await this.page.keyboard.press('Tab')
      const href = await this.page.evaluate(() =>
        document.activeElement?.getAttribute('href')
      )
      if (href && href.includes('/journal')) {
        found = true
        break
      }
    }
    expect(found, 'A sidebar nav link should be reachable by Tab').toBe(true)
  }
)

Then('the title field should accept keyboard input', async function (this: CustomWorld) {
  const titleInput = this.page.getByLabel('Title', { exact: true })
  await titleInput.focus()
  await this.page.keyboard.type('Keyboard test entry')
  await expect(titleInput).toHaveValue('Keyboard test entry')
})

Then('the category field should be keyboard focusable', async function (this: CustomWorld) {
  const category = this.page.getByLabel('Category', { exact: true })
  await category.focus()
  const isFocused = await category.evaluate((el) => el === document.activeElement)
  expect(isFocused).toBe(true)
})

Then(
  'the pagination next control should be keyboard focusable if visible',
  async function (this: CustomWorld) {
    const next = this.page
      .getByRole('link', { name: /next/i })
      .or(this.page.getByRole('button', { name: /next/i }))
      .first()
    if (await next.isVisible().catch(() => false)) {
      await next.focus()
      const isFocused = await next.evaluate((el) => el === document.activeElement)
      expect(isFocused).toBe(true)
    }
    // If no pagination controls exist, the scenario passes vacuously
  }
)

Then(
  'the delete dialog should close on Escape if it is opened',
  async function (this: CustomWorld) {
    const deleteButton = this.page.getByRole('button', { name: /delete/i }).first()
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click()
      const dialog = this.page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await this.page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    }
    // If no delete button is visible, the scenario passes vacuously
  }
)

Then(
  'the Clarity panel should toggle open and closed with the keyboard if the button is present',
  async function (this: CustomWorld) {
    const compass = this.page
      .getByRole('button', { name: /open clarity/i })
      .first()
    if (await compass.isVisible().catch(() => false)) {
      await compass.focus()
      await this.page.keyboard.press('Enter')
      const panel = this.page.getByRole('dialog', { name: /clarity/i })
      await expect(panel).toBeVisible()
      await this.page.keyboard.press('Escape')
      await expect(panel).not.toBeVisible()
    }
    // If Clarity button is not visible, the scenario passes vacuously
  }
)

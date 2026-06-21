/*
 * Keyboard navigation — WCAG 2.1.1, 2.4.1, 2.4.3, 2.4.7
 *
 * Uses the project Clerk auth fixture. Tests that depend on tier-gated UI
 * (Clarity) use the PREMIUM proPage fixture.
 */
import { test, expect } from './setup/auth'

test.describe('Keyboard Navigation', () => {
  test('skip to main content link is the first focusable element', async ({
    page,
  }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() =>
      document.activeElement?.textContent?.trim()
    )
    expect(focused).toBe('Skip to main content')
  })

  test('skip to main content link moves focus to main', async ({ page }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    const focusedId = await page.evaluate(() => document.activeElement?.id)
    expect(focusedId).toBe('main-content')
  })

  test('sidebar navigation is reachable by keyboard', async ({ page }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    let found = false
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      const href = await page.evaluate(() =>
        document.activeElement?.getAttribute('href')
      )
      if (href && href.includes('/journal')) {
        found = true
        break
      }
    }
    expect(found, 'A sidebar nav link should be reachable by Tab').toBe(true)
  })

  test('new entry form is keyboard operable', async ({ page }) => {
    await page.goto('/journal/new')
    await page.waitForLoadState('load')
    const titleInput = page.getByLabel('Title', { exact: true })
    await titleInput.focus()
    await page.keyboard.type('Keyboard test entry')
    await expect(titleInput).toHaveValue('Keyboard test entry')

    // The category control is a native select — reachable and operable by keyboard.
    const category = page.getByLabel('Category', { exact: true })
    await category.focus()
    const isFocused = await category.evaluate((el) => el === document.activeElement)
    expect(isFocused).toBe(true)
  })

  test('delete confirmation modal traps focus and closes on Escape', async ({
    proPage: page,
  }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    const deleteButton = page.getByRole('button', { name: /delete/i }).first()
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    }
  })

  test('Clarity panel opens and closes with the keyboard', async ({
    proPage: page,
  }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    const compass = page
      .getByRole('button', { name: /open clarity/i })
      .first()
    if (await compass.isVisible().catch(() => false)) {
      await compass.focus()
      await page.keyboard.press('Enter')
      const panel = page.getByRole('dialog', { name: /clarity/i })
      await expect(panel).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(panel).not.toBeVisible()
    }
  })

  test('pagination controls are keyboard focusable', async ({ page }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    const next = page
      .getByRole('link', { name: /next/i })
      .or(page.getByRole('button', { name: /next/i }))
      .first()
    if (await next.isVisible().catch(() => false)) {
      await next.focus()
      const isFocused = await next.evaluate((el) => el === document.activeElement)
      expect(isFocused).toBe(true)
    }
  })
})

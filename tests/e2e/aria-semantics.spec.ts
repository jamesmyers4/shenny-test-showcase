/*
 * ARIA & semantic structure — WCAG 1.1.1, 1.3.1, 2.4.2, 2.4.6, 3.1.1, 4.1.2, 4.1.3
 *
 * Scanned as an authenticated PREMIUM user so tier-gated pages render fully.
 */
import { test, expect } from './setup/auth'

test.describe('ARIA and Semantic Structure', () => {
  test('every page has exactly one h1', async ({ proPage: page }) => {
    const pages = [
      '/journal',
      '/recordings',
      '/message-analysis',
      '/insight-reports',
      '/cases',
      '/settings',
      '/settings/plans',
      '/exports',
      '/dashboard',
    ]
    for (const path of pages) {
      await page.goto(path)
      await page.waitForLoadState('load')
      const h1Count = await page.locator('h1').count()
      expect(h1Count, `${path} should have exactly one h1`).toBe(1)
    }
  })

  test('html element has lang="en"', async ({ page }) => {
    await page.goto('/journal')
    const lang = await page.evaluate(() =>
      document.documentElement.getAttribute('lang')
    )
    expect(lang).toBe('en')
  })

  test('all images have alt text', async ({ page }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    for (const img of await page.locator('img').all()) {
      expect(await img.getAttribute('alt')).not.toBeNull()
    }
  })

  test('icon-only buttons have an accessible name', async ({ page }) => {
    await page.goto('/journal')
    await page.waitForLoadState('load')
    for (const button of await page.locator('button').all()) {
      const text = (await button.textContent())?.trim()
      if (text && text.length > 0) continue
      const ariaLabel = await button.getAttribute('aria-label')
      const ariaLabelledBy = await button.getAttribute('aria-labelledby')
      const title = await button.getAttribute('title')
      expect(
        ariaLabel || ariaLabelledBy || title,
        'Icon-only button is missing an accessible name'
      ).toBeTruthy()
    }
  })

  test('form inputs with an id have an associated label', async ({ page }) => {
    await page.goto('/journal/new')
    await page.waitForLoadState('load')
    for (const input of await page.locator('input, textarea, select').all()) {
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      if (id) {
        const hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0
        expect(
          hasLabel || ariaLabel || ariaLabelledBy,
          `Input #${id} has no accessible label`
        ).toBeTruthy()
      }
    }
  })

  test('dynamic status regions use aria-live', async ({ proPage: page }) => {
    await page.goto('/exports')
    await page.waitForLoadState('load')
    const region = page.locator('[aria-live]').first()
    await expect(region).toHaveCount(1)
    const liveValue = await region.getAttribute('aria-live')
    expect(['polite', 'assertive']).toContain(liveValue)
  })

  test('page titles are descriptive', async ({ proPage: page }) => {
    const expectedTitles: Record<string, string> = {
      '/journal': 'Parent Journal | Shenny',
      '/recordings': 'Recordings | Shenny',
      '/message-analysis': 'Message Analysis | Shenny',
      '/insight-reports': 'Insight Reports | Shenny',
      '/settings': 'Settings | Shenny',
      '/settings/plans': 'Billing & Plans | Shenny',
    }
    for (const [path, title] of Object.entries(expectedTitles)) {
      await page.goto(path)
      await page.waitForLoadState('load')
      await expect(page).toHaveTitle(title)
    }
  })
})

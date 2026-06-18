import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { CustomWorld } from '../support/world'

const DEFAULT_EXCLUDES = ['iframe', '.crisp-client', '#crisp-chatbox']
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

async function scanPage(
  page: CustomWorld['page'],
  opts: { exclude?: string[]; disableRules?: string[] } = {}
) {
  await page.locator('h1').first().waitFor({ state: 'visible' }).catch(() => {})
  const builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS])
  for (const sel of [...DEFAULT_EXCLUDES, ...(opts.exclude ?? [])]) {
    builder.exclude(sel)
  }
  if (opts.disableRules?.length) {
    builder.disableRules(opts.disableRules)
  }
  return builder.analyze()
}

function formatViolations(violations: unknown[]): string {
  return (violations as Array<{ id: string; impact?: string; description: string; nodes: Array<{ target: string[] }> }>)
    .map(
      (v) =>
        `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes
          .slice(0, 2)
          .map((n) => n.target.join(', '))
          .join(' | ')})`
    )
    .join('\n')
}

When('I navigate to the journal page for a11y', async function (this: CustomWorld) {
  await this.page.goto('/journal')
  await this.page.waitForLoadState('load')
})

When('I navigate to the recordings page for a11y', async function (this: CustomWorld) {
  await this.page.goto('/recordings')
  await this.page.waitForLoadState('load')
})

Then('the page should have no WCAG violations', async function (this: CustomWorld) {
  const results = await scanPage(this.page)
  expect(
    results.violations,
    `WCAG violations:\n${formatViolations(results.violations)}`
  ).toHaveLength(0)
})

Then(
  'the page should have no WCAG violations excluding {string}',
  async function (this: CustomWorld, selector: string) {
    const results = await scanPage(this.page, { exclude: [selector] })
    expect(
      results.violations,
      `WCAG violations:\n${formatViolations(results.violations)}`
    ).toHaveLength(0)
  }
)

Then(
  'the page should have no WCAG violations excluding color-contrast',
  async function (this: CustomWorld) {
    const results = await scanPage(this.page, { disableRules: ['color-contrast'] })
    expect(
      results.violations,
      `WCAG violations:\n${formatViolations(results.violations)}`
    ).toHaveLength(0)
  }
)

Then('every app page should have exactly one h1', async function (this: CustomWorld) {
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
    await this.page.goto(path)
    await this.page.waitForLoadState('load')
    const h1Count = await this.page.locator('h1').count()
    expect(h1Count, `${path} should have exactly one h1`).toBe(1)
  }
})

Then('the html element should have lang set to {string}', async function (this: CustomWorld, lang: string) {
  const actual = await this.page.evaluate(() =>
    document.documentElement.getAttribute('lang')
  )
  expect(actual).toBe(lang)
})

Then('all images should have alt text', async function (this: CustomWorld) {
  for (const img of await this.page.locator('img').all()) {
    expect(await img.getAttribute('alt')).not.toBeNull()
  }
})

Then('dynamic status regions should use aria-live', async function (this: CustomWorld) {
  const region = this.page.locator('[aria-live]').first()
  await expect(region).toHaveCount(1)
  const liveValue = await region.getAttribute('aria-live')
  expect(['polite', 'assertive']).toContain(liveValue)
})

Then('each key page should have a descriptive title', async function (this: CustomWorld) {
  const expectedTitles: Record<string, string> = {
    '/journal': 'Parent Journal | App',
    '/recordings': 'Recordings | App',
    '/message-analysis': 'Message Analysis | App',
    '/insight-reports': 'Insight Reports | App',
    '/settings': 'Settings | App',
    '/settings/plans': 'Billing & Plans | App',
  }
  for (const [path, title] of Object.entries(expectedTitles)) {
    await this.page.goto(path)
    await this.page.waitForLoadState('load')
    await expect(this.page).toHaveTitle(title)
  }
})

Then('all icon-only buttons should have an accessible name', async function (this: CustomWorld) {
  for (const button of await this.page.locator('button').all()) {
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

Then('all form inputs with an id should have an associated label', async function (this: CustomWorld) {
  for (const input of await this.page.locator('input, textarea, select').all()) {
    const id = await input.getAttribute('id')
    const ariaLabel = await input.getAttribute('aria-label')
    const ariaLabelledBy = await input.getAttribute('aria-labelledby')
    if (id) {
      const hasLabel = (await this.page.locator(`label[for="${id}"]`).count()) > 0
      expect(
        hasLabel || ariaLabel || ariaLabelledBy,
        `Input #${id} has no accessible label`
      ).toBeTruthy()
    }
  }
})

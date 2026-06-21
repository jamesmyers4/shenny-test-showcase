import { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Runs an axe-core accessibility scan against the current page state,
 * restricted to the WCAG 2.0/2.1 Level A and AA rule sets.
 */
export async function checkAccessibility(
  page: Page,
  options?: {
    include?: string[]
    exclude?: string[]
    disableRules?: string[]
  }
) {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ])

  if (options?.include) {
    for (const sel of options.include) builder.include(sel)
  }
  if (options?.exclude) {
    for (const sel of options.exclude) builder.exclude(sel)
  }
  if (options?.disableRules?.length) {
    builder.disableRules(options.disableRules)
  }

  const results = await builder.analyze()
  return results
}

/** Formats axe violations into a readable failure message. */
export function formatViolations(violations: unknown[]): string {
  return (violations as AxeViolation[])
    .map(
      (v) =>
        `\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
        v.nodes
          .slice(0, 3)
          .map(
            (n) =>
              `  Element: ${n.target.join(', ')}\n` +
              `  Fix: ${n.failureSummary}`
          )
          .join('\n')
    )
    .join('\n')
}

type AxeViolation = {
  id: string
  impact?: string
  description: string
  nodes: { target: string[]; failureSummary?: string }[]
}

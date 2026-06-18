import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import {
  setUserTier,
  createTestInsightReport,
  deleteTestInsightReport,
  createTestEntryWithDate,
  deleteTestEntry,
} from '../../e2e/helpers/db.ts'
import { CustomWorld } from '../support/world'

const CLERK_ID = () => process.env.E2E_CLERK_USER_ID!

When('I visit the Insight Reports page', async function (this: CustomWorld) {
  await this.page.goto('/insight-reports')
  await this.page.waitForLoadState('load')
})

Then('I should see the Insight Reports heading', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('heading', { name: /insight reports/i }).first()
  ).toBeVisible({ timeout: 5000 })
})

Then('I should not see an upgrade gate', async function (this: CustomWorld) {
  await expect(
    this.page.getByText(/upgrade to premium to unlock insight reports/i)
  ).not.toBeVisible({ timeout: 3000 })
})

Given('I am a STANDARD plan user', async function (this: CustomWorld) {
  await setUserTier(CLERK_ID(), 'STANDARD', {
    subscriptionStatus: 'active',
    hasEverSubscribed: true,
  })
})

Given('I have a SCHEDULED InsightReport in my account', async function (this: CustomWorld) {
  const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
  const oldEntryId = await createTestEntryWithDate(CLERK_ID(), ninetyFiveDaysAgo, 'E2E Old Entry for Threshold')
  const reportId = await createTestInsightReport(CLERK_ID(), 'SCHEDULED')
  await setUserTier(CLERK_ID(), 'PREMIUM', { subscriptionStatus: 'active', hasEverSubscribed: true })
  // Store IDs for cleanup — attach to world via a side channel
  ;(this as CustomWorld & { _cleanupReportId?: string; _cleanupOldEntryId?: string })._cleanupReportId = reportId
  ;(this as CustomWorld & { _cleanupOldEntryId?: string })._cleanupOldEntryId = oldEntryId
})

Given('I have a VELOCITY InsightReport in my account', async function (this: CustomWorld) {
  const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
  const oldEntryId = await createTestEntryWithDate(CLERK_ID(), ninetyFiveDaysAgo, 'E2E Old Entry for Alert')
  const reportId = await createTestInsightReport(CLERK_ID(), 'VELOCITY')
  await setUserTier(CLERK_ID(), 'PREMIUM', { subscriptionStatus: 'active', hasEverSubscribed: true })
  ;(this as CustomWorld & { _cleanupReportId?: string; _cleanupOldEntryId?: string })._cleanupReportId = reportId
  ;(this as CustomWorld & { _cleanupOldEntryId?: string })._cleanupOldEntryId = oldEntryId
})

Then('I should see {string} displayed', async function (this: CustomWorld, label: string) {
  await expect(this.page.getByText(label, { exact: false })).toBeVisible({ timeout: 8000 })

  const world = this as CustomWorld & { _cleanupReportId?: string; _cleanupOldEntryId?: string }
  if (world._cleanupReportId) {
    await deleteTestInsightReport(world._cleanupReportId)
    world._cleanupReportId = undefined
  }
  if (world._cleanupOldEntryId) {
    await deleteTestEntry(world._cleanupOldEntryId)
    world._cleanupOldEntryId = undefined
  }
  await setUserTier(CLERK_ID(), 'FREE', { subscriptionStatus: null, hasEverSubscribed: false })
})

Then('I should not see {string} as a raw trigger type', async function (this: CustomWorld, rawType: string) {
  await expect(this.page.getByText(rawType, { exact: true })).not.toBeVisible()
})

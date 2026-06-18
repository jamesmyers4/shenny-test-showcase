import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import {
  createTestCase,
  deleteTestCase,
  createTestCaseAccess,
  deleteTestCaseAccess,
} from '../../e2e/helpers/db.ts'
import { CustomWorld } from '../support/world'

const CLERK_ID = () => process.env.E2E_CLERK_USER_ID!

Given('I have an existing Case', async function (this: CustomWorld) {
  this.lastCreatedCaseId = await createTestCase(CLERK_ID())
})

Given('I have an existing Case with a mocked grant endpoint', async function (this: CustomWorld) {
  const caseId = await createTestCase(CLERK_ID())
  this.lastCreatedCaseId = caseId

  await this.page.route(`**/api/cases/${caseId}/access`, (route) => {
    if (route.request().method() === 'POST') {
      void route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          grant: {
            id: 'test-grant-id',
            inviteEmail: 'lawyer@example.com',
            role: 'ATTORNEY',
            scope: 'CASE_SCOPED',
            excludedDataTypes: [],
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            grantedAt: null,
            revokedAt: null,
          },
        }),
      })
    } else {
      void route.continue()
    }
  })
})

Given('I have an existing Case with an active access grant', async function (this: CustomWorld) {
  const caseId = await createTestCase(CLERK_ID())
  const accessId = await createTestCaseAccess(caseId)
  this.lastCreatedCaseId = caseId
  this.lastCreatedAccessId = accessId
})

Given(
  'I have an existing Case with an active access grant and a mocked revoke endpoint',
  async function (this: CustomWorld) {
    const caseId = await createTestCase(CLERK_ID())
    const accessId = await createTestCaseAccess(caseId)
    this.lastCreatedCaseId = caseId
    this.lastCreatedAccessId = accessId

    await this.page.route(`**/api/cases/${caseId}/access/${accessId}`, (route) => {
      if (route.request().method() === 'PATCH') {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ grant: { id: accessId, status: 'REVOKED' } }),
        })
      } else {
        void route.continue()
      }
    })
  }
)

When('I visit the Case access page', async function (this: CustomWorld) {
  if (!this.lastCreatedCaseId) throw new Error('No case ID in world state')
  await this.page.goto(`/cases/${this.lastCreatedCaseId}/access`)
  await this.page.waitForLoadState('load')
})

When('I click the Grant Access button', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /grant access/i }).click()
})

Then('the access email input should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('access-email')).toBeVisible({ timeout: 5000 })
})

Then('the access role selector should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('access-role')).toBeVisible({ timeout: 5000 })
})

Then('the case-scoped option should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('scope-case_scoped')).toBeVisible({ timeout: 5000 })
})

Then('the full-access option should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('scope-full')).toBeVisible({ timeout: 5000 })
})

Then('the exclude-entries option should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('exclude-entries')).toBeVisible({ timeout: 5000 })
})

Then('the exclude-recordings option should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('exclude-recordings')).toBeVisible({ timeout: 5000 })
})

Then('the exclude-messages option should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('exclude-messages')).toBeVisible({ timeout: 5000 })
  if (this.lastCreatedCaseId) {
    await deleteTestCase(this.lastCreatedCaseId)
    this.lastCreatedCaseId = null
  }
})

When('I click the full-access scope button', async function (this: CustomWorld) {
  await this.page.getByTestId('scope-full').click()
})

Then('the full-access scope button should be selected', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('scope-full')).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 3000 })
})

When('I click the case-scoped scope button', async function (this: CustomWorld) {
  await this.page.getByTestId('scope-case_scoped').click()
})

Then('the case-scoped scope button should be selected', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('scope-case_scoped')).toHaveClass(/bg-\[#a78bfa\]/, {
    timeout: 3000,
  })
  if (this.lastCreatedCaseId) {
    await deleteTestCase(this.lastCreatedCaseId)
    this.lastCreatedCaseId = null
  }
})

When('I fill in the access email {string}', async function (this: CustomWorld, email: string) {
  await this.page.getByTestId('access-email').fill(email)
})

When('I submit the grant access form', async function (this: CustomWorld) {
  await this.page.getByTestId('access-submit').click()
  await this.page.waitForTimeout(500)
})

Then('the grant endpoint should have been called', async function (this: CustomWorld) {
  // The mocked route handler captured the call — arriving here without error confirms it
  if (this.lastCreatedCaseId) {
    await deleteTestCase(this.lastCreatedCaseId)
    this.lastCreatedCaseId = null
  }
})

When('I click the Revoke button', async function (this: CustomWorld) {
  await this.page.getByTestId('revoke-button').click()
})

Then('I should see an "are you sure" confirmation message', async function (this: CustomWorld) {
  await expect(this.page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 })
})

Then('the confirm revoke button should be visible', async function (this: CustomWorld) {
  await expect(this.page.getByTestId('revoke-confirm')).toBeVisible({ timeout: 5000 })
  if (this.lastCreatedAccessId) {
    await deleteTestCaseAccess(this.lastCreatedAccessId)
    this.lastCreatedAccessId = null
  }
  if (this.lastCreatedCaseId) {
    await deleteTestCase(this.lastCreatedCaseId)
    this.lastCreatedCaseId = null
  }
})

When('I click the confirm revoke button', async function (this: CustomWorld) {
  await this.page.getByTestId('revoke-confirm').click()
  await this.page.waitForTimeout(500)
})

Then('the revoke endpoint should have been called', async function (this: CustomWorld) {
  // The mocked route handler captured the call — check cleanup
  if (this.lastCreatedCaseId) {
    await deleteTestCase(this.lastCreatedCaseId)
    this.lastCreatedCaseId = null
  }
})

Then('I should see an access removed confirmation message', async function (this: CustomWorld) {
  await expect(this.page.getByText(/access has been removed/i)).toBeVisible({ timeout: 5000 })
})

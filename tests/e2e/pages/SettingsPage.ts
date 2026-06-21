import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings')
    await this.page.waitForLoadState('load')
  }

  async gotoPlans() {
    await this.page.goto('/settings/plans')
    await this.page.waitForLoadState('load')
  }

  async expectManagePlanLinkVisible() {
    await expect(
      this.page.getByRole('link', { name: /manage plan/i })
    ).toBeVisible({ timeout: 5000 })
  }

  async expectManagePlanLinkHidden() {
    await expect(
      this.page.getByRole('link', { name: /manage plan/i })
    ).not.toBeVisible({ timeout: 5000 })
  }

  async clickManagePlan() {
    await this.page.getByRole('link', { name: /manage plan/i }).click()
  }

  async clickUpgradeOnPlansPage() {
    await this.page.getByRole('button', { name: /choose premium/i }).click()
  }

  async expectAnnualPreselected() {
    await this.gotoPlans()
    const annualBtn = this.page.getByRole('button', { name: /annual/i })
    await expect(annualBtn).toHaveClass(/bg-\[#a78bfa\]/, { timeout: 5000 })
  }

  async expectPlanOptionsVisible() {
    await this.gotoPlans()
    await expect(
      this.page.getByRole('button', { name: /choose standard/i }).first()
    ).toBeVisible({ timeout: 5000 })
    await expect(
      this.page.getByRole('button', { name: /choose premium/i }).first()
    ).toBeVisible({ timeout: 5000 })
  }

  async expectPricingCopy() {
    await this.gotoPlans()
    // Annual is pre-selected by default — verify annual prices are visible
    await expect(this.page.getByText(/\$47\/year/)).toBeVisible({ timeout: 5000 })
    await expect(this.page.getByText(/\$94\/year/)).toBeVisible({ timeout: 5000 })
  }

  async expectDangerZoneVisible() {
    await expect(
      this.page.getByRole('heading', { name: /delete account/i })
    ).toBeVisible({ timeout: 5000 })
  }

  async typeDeleteConfirmation() {
    await this.page.fill('input[placeholder="DELETE"]', 'DELETE')
  }

  async clickDeleteAccount() {
    await this.page.getByRole('button', { name: /delete my account/i }).click()
  }
}

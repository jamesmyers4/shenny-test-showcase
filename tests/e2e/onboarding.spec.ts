import { test, expect } from './setup/auth'
import { setUserOnboarding, disconnectDb } from './helpers/db'
import { OnboardingPage } from './pages/OnboardingPage'

const CLERK_ID = process.env.E2E_CLERK_USER_ID!

// Restore the standard seeded state after all onboarding tests so that
// subsequent test files (journal, clarity) see isOnboardingComplete: true.
test.afterAll(async () => {
  await setUserOnboarding(CLERK_ID, {
    isOnboardingComplete: true,
    onboardingStep: 5,
    preferredName: 'E2E Parent',
    coParentNames: ['E2E CoParent'],
    childrenNames: ['E2E Child'],
  })
  await disconnectDb()
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Full onboarding flow completes and redirects to journal
//
// State: isOnboardingComplete: false, onboardingStep: 0
// Flow: navigate to /onboarding → steps 1-3 required → skip 4 and 5 →
//       completion screen → "Create your first entry" → /journal/new
// ─────────────────────────────────────────────────────────────────────────────
test('onboarding — full flow completes and redirects to journal', async ({ page }) => {
  await setUserOnboarding(CLERK_ID, { isOnboardingComplete: false, onboardingStep: 0 })

  const onboarding = new OnboardingPage(page)
  await onboarding.navigateTo()
  await onboarding.completeFlow('E2E Parent', 'E2E CoParent', 'E2E Child')
  await onboarding.expectCompletionScreen()

  // CompletionScreen uses window.location.href after session.reload()
  await page.getByRole('button', { name: 'Create your first entry' }).click()
  await page.waitForURL(/\/journal\/new/, { timeout: 15000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Middleware gate: unauthenticated-for-onboarding users are redirected
//
// State: isOnboardingComplete: false
// Navigate directly to /journal — middleware reads DB, redirects to /onboarding.
// ─────────────────────────────────────────────────────────────────────────────
test('onboarding — middleware gate redirects incomplete users to /onboarding', async ({ page }) => {
  await setUserOnboarding(CLERK_ID, { isOnboardingComplete: false, onboardingStep: 0 })

  await page.goto('/journal')
  await page.waitForURL(/\/onboarding/, { timeout: 8000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Onboarding resumes from the correct step on page load
//
// State: isOnboardingComplete: false, onboardingStep: 2
// The server passes initialStep: 2 to OnboardingFlow → step 3 (children names)
// should be the first thing the Parent sees.
// ─────────────────────────────────────────────────────────────────────────────
test('onboarding — resumes from correct step on refresh', async ({ page }) => {
  await setUserOnboarding(CLERK_ID, { isOnboardingComplete: false, onboardingStep: 2 })

  const onboarding = new OnboardingPage(page)
  await onboarding.navigateTo()

  // Step index 2 → OnboardingFlow renders Step3ChildrenNames
  await expect(page.getByText("What are your children's names?")).toBeVisible()
})

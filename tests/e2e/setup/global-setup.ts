import { clerkSetup } from '@clerk/testing/playwright'
import { config as loadDotenv } from 'dotenv'
import path from 'path'

// global-setup runs in a Node.js process before the webServer starts.
// Load .env.test explicitly — Next.js auto-loading doesn't apply here.
loadDotenv({ path: path.resolve('.env.test'), override: true })

// Fixed IDs for the DB-only Premium fixture user.
// This user does NOT exist in Clerk; it is used only to represent a PREMIUM-plan
// DB record. Premium-gated tests auth as the primary Clerk user with a temporary
// plan elevation via setUserPlan() — see tests/e2e/setup/auth.ts.
export const E2E_PRO_FIXTURE_CLERK_ID = 'user_e2eprofixtureonly0000001'
export const E2E_PRO_FIXTURE_EMAIL = 'e2e-pro-fixture@e2e-test.local'
export const E2E_PRO_FIXTURE_ID = 'e2eprouserfixture000000000001'

export default async function globalSetup() {
  await clerkSetup()

  // Ensure the test user has a DB record with Free access and onboarding complete.
  // The Clerk user must already exist in your Clerk dev instance.
  const clerkId = process.env.E2E_CLERK_USER_ID
  const email = process.env.E2E_CLERK_USER_EMAIL

  if (!clerkId || clerkId.includes('FILL_IN')) {
    throw new Error(
      'E2E_CLERK_USER_ID is not set in .env.test. ' +
      'Create a test user in your Clerk dashboard, then set their user ID.'
    )
  }

  // Import Prisma after env vars are loaded so DATABASE_URL is available.
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaNeon } = await import('@prisma/adapter-neon')

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL_OVERRIDE ?? process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    // Primary test user — FREE tier. Premium-gated tests temporarily elevate this
    // user's plan to PREMIUM via the proPage fixture in auth.ts.
    await prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email: email ?? `${clerkId}@e2e-test.local`,
        plan: 'FREE',
        trialStartedAt: null,
        preferredName: 'E2E Parent',
        firstName: 'E2E',
        coParentNames: ['E2E CoParent'],
        childrenNames: ['E2E Child'],
        isOnboardingComplete: true,
        onboardingStep: 5,
      },
      update: {
        plan: 'FREE',
        trialStartedAt: null,
        preferredName: 'E2E Parent',
        coParentNames: ['E2E CoParent'],
        childrenNames: ['E2E Child'],
        isOnboardingComplete: true,
        onboardingStep: 5,
      },
    })

    // Pro fixture user — DB only, no Clerk account.
    // Exists as a reference record; not used directly for browser auth.
    await prisma.user.upsert({
      where: { clerkId: E2E_PRO_FIXTURE_CLERK_ID },
      create: {
        id: E2E_PRO_FIXTURE_ID,
        clerkId: E2E_PRO_FIXTURE_CLERK_ID,
        email: E2E_PRO_FIXTURE_EMAIL,
        plan: 'PREMIUM',
        trialStartedAt: null,
        coParentNames: [],
        childrenNames: [],
        isOnboardingComplete: true,
        onboardingStep: 5,
      },
      update: {
        plan: 'PREMIUM',
        trialStartedAt: null,
        isOnboardingComplete: true,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

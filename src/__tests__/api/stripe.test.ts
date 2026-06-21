/**
 * stripe.test.ts — Stripe billing API contract tests
 *
 * Covers:
 *   POST /api/stripe/checkout
 *   POST /api/stripe/portal
 *   POST /api/stripe/webhook
 *
 * The Stripe SDK and Resend are mocked — no real network calls are made.
 * Prisma hits the real test DB (same as other API tests).
 */

import { vi, type Mock } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

// A regular `function` (not an arrow) is required: this mock is invoked via
// `new Resend(...)` in the webhook route.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
      },
    }
  }),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
  getPlanFromPriceId: vi.fn((priceId: string) => {
    const map: Record<string, 'STANDARD' | 'PREMIUM'> = {
      price_test_std_monthly: 'STANDARD',
      price_test_std_annual: 'STANDARD',
      price_test_prem_monthly: 'PREMIUM',
      price_test_prem_annual: 'PREMIUM',
    }
    return map[priceId] ?? null
  }),
  isKnownPriceId: vi.fn((priceId: string) =>
    ['price_test_std_monthly', 'price_test_std_annual', 'price_test_prem_monthly', 'price_test_prem_annual'].includes(priceId)
  ),
}))

import { api } from '../helpers/client'
import { setAuthUser, clearAuth, TEST_CLERK_ID_A } from '../helpers/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getPeriodKey } from '@/lib/access'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStripe = stripe as unknown as {
  customers: { create: Mock }
  checkout: { sessions: { create: Mock } }
  billingPortal: { sessions: { create: Mock } }
  webhooks: { constructEvent: Mock }
  subscriptions: { retrieve: Mock }
}

const STRIPE_CUSTOMER_ID = 'cus_test_stripe_customer'
const STRIPE_SUBSCRIPTION_ID = 'sub_test_subscription'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCheckoutEvent(priceId: string, clerkId: string): object {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: STRIPE_CUSTOMER_ID,
        subscription: STRIPE_SUBSCRIPTION_ID,
        metadata: { userId: clerkId },
      },
    },
  }
}

function makeSubscriptionUpdatedEvent(priceId: string, status = 'active', cancelAtPeriodEnd = false): object {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: {
        customer: STRIPE_CUSTOMER_ID,
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        items: {
          data: [
            {
              price: { id: priceId },
              current_period_end: 1800000000,
            },
          ],
        },
      },
    },
  }
}

function makeSubscriptionDeletedEvent(): object {
  return {
    type: 'customer.subscription.deleted',
    data: {
      object: {
        customer: STRIPE_CUSTOMER_ID,
        status: 'canceled',
        cancel_at_period_end: false,
        items: { data: [] },
      },
    },
  }
}

function makeInvoicePaymentFailedEvent(): object {
  return {
    type: 'invoice.payment_failed',
    data: {
      object: {
        customer: STRIPE_CUSTOMER_ID,
        lines: { data: [] },
      },
    },
  }
}

function makeInvoicePaymentSucceededEvent(): object {
  return {
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        customer: STRIPE_CUSTOMER_ID,
        lines: {
          data: [{ period: { end: 1800000000 } }],
        },
      },
    },
  }
}

function makeSubscriptionRetrieveResponse(priceId: string) {
  return {
    items: {
      data: [
        {
          price: { id: priceId },
          current_period_end: 1800000000,
        },
      ],
    },
  }
}

// ── fixture setup ─────────────────────────────────────────────────────────────

async function ensureUserHasCustomerId(clerkId: string) {
  await prisma.user.update({
    where: { clerkId },
    data: { stripeCustomerId: STRIPE_CUSTOMER_ID },
  })
}

async function clearStripeFields(clerkId: string) {
  await prisma.user.update({
    where: { clerkId },
    data: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      plan: 'FREE',
      hasEverSubscribed: false,
      cancelAtPeriodEnd: false,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/checkout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/checkout', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearStripeFields(TEST_CLERK_ID_A)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().post('/api/stripe/checkout').send({ priceId: 'price_test_std_monthly' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an unknown price ID', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/stripe/checkout').send({ priceId: 'price_unknown_garbage' })
    expect(res.status).toBe(400)
  })

  it('returns { url } for valid STANDARD monthly price ID', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await ensureUserHasCustomerId(TEST_CLERK_ID_A)
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/test-session-standard',
    })

    const res = await api().post('/api/stripe/checkout').send({ priceId: 'price_test_std_monthly' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('url', 'https://checkout.stripe.com/test-session-standard')
  })

  it('returns { url } for valid PREMIUM annual price ID', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await ensureUserHasCustomerId(TEST_CLERK_ID_A)
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/test-session-premium',
    })

    const res = await api().post('/api/stripe/checkout').send({ priceId: 'price_test_prem_annual' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('url', 'https://checkout.stripe.com/test-session-premium')
  })

  it('creates a Stripe customer when stripeCustomerId is null', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    // Ensure no customer ID is set
    await clearStripeFields(TEST_CLERK_ID_A)
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_newly_created' })
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/new-customer-session',
    })

    const res = await api().post('/api/stripe/checkout').send({ priceId: 'price_test_prem_monthly' })
    expect(res.status).toBe(200)
    expect(mockStripe.customers.create).toHaveBeenCalledTimes(1)

    // Verify customerId was persisted to DB
    const user = await prisma.user.findUnique({
      where: { clerkId: TEST_CLERK_ID_A },
      select: { stripeCustomerId: true },
    })
    expect(user?.stripeCustomerId).toBe('cus_newly_created')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/portal
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/portal', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().post('/api/stripe/portal').send()
    expect(res.status).toBe(401)
  })

  it('returns 400 when user has no stripeCustomerId', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await clearStripeFields(TEST_CLERK_ID_A)

    const res = await api().post('/api/stripe/portal').send()
    expect(res.status).toBe(400)
  })

  it('returns { url } for a user with a valid stripeCustomerId', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    await ensureUserHasCustomerId(TEST_CLERK_ID_A)
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/test-portal',
    })

    const res = await api().post('/api/stripe/portal').send()
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('url', 'https://billing.stripe.com/test-portal')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/webhook
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearStripeFields(TEST_CLERK_ID_A)
    await ensureUserHasCustomerId(TEST_CLERK_ID_A)
  })

  it('returns 400 for invalid or missing signature', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await api()
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'bad-sig')
      .send('{}')
    expect(res.status).toBe(400)
  })

  describe('checkout.session.completed', () => {
    it('sets plan to PREMIUM for premium price ID', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeCheckoutEvent('price_test_prem_annual', TEST_CLERK_ID_A)
      )
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        makeSubscriptionRetrieveResponse('price_test_prem_annual')
      )

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { plan: true },
      })
      expect(user?.plan).toBe('PREMIUM')
    })

    it('sets plan to STANDARD for standard price ID', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeCheckoutEvent('price_test_std_monthly', TEST_CLERK_ID_A)
      )
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        makeSubscriptionRetrieveResponse('price_test_std_monthly')
      )

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { plan: true },
      })
      expect(user?.plan).toBe('STANDARD')
    })

    it('sets hasEverSubscribed to true', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeCheckoutEvent('price_test_prem_annual', TEST_CLERK_ID_A)
      )
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        makeSubscriptionRetrieveResponse('price_test_prem_annual')
      )

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { hasEverSubscribed: true },
      })
      expect(user?.hasEverSubscribed).toBe(true)
    })

    it('sets trialEndsAt to null', async () => {
      // Give user an active trial first
      await prisma.user.update({
        where: { clerkId: TEST_CLERK_ID_A },
        data: { trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeCheckoutEvent('price_test_prem_annual', TEST_CLERK_ID_A)
      )
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        makeSubscriptionRetrieveResponse('price_test_prem_annual')
      )

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { trialEndsAt: true },
      })
      expect(user?.trialEndsAt).toBeNull()
    })

    it('sets subscriptionStatus to active', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeCheckoutEvent('price_test_prem_annual', TEST_CLERK_ID_A)
      )
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        makeSubscriptionRetrieveResponse('price_test_prem_annual')
      )

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { subscriptionStatus: true },
      })
      expect(user?.subscriptionStatus).toBe('active')
    })
  })

  describe('customer.subscription.updated', () => {
    it('updates plan and currentPeriodEnd', async () => {
      await prisma.user.update({
        where: { clerkId: TEST_CLERK_ID_A },
        data: { plan: 'PREMIUM', subscriptionStatus: 'active', hasEverSubscribed: true },
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeSubscriptionUpdatedEvent('price_test_std_monthly', 'active')
      )

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { plan: true, currentPeriodEnd: true },
      })
      expect(user?.plan).toBe('STANDARD')
      expect(user?.currentPeriodEnd).not.toBeNull()
    })

    it('sets cancelAtPeriodEnd to true when Stripe signals cancellation scheduled', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeSubscriptionUpdatedEvent('price_test_prem_annual', 'active', true)
      )

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { cancelAtPeriodEnd: true },
      })
      expect(user?.cancelAtPeriodEnd).toBe(true)
    })
  })

  describe('customer.subscription.deleted', () => {
    beforeEach(async () => {
      await prisma.user.update({
        where: { clerkId: TEST_CLERK_ID_A },
        data: { plan: 'PREMIUM', subscriptionStatus: 'active', hasEverSubscribed: true },
      })
    })

    it('sets plan to FREE', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeSubscriptionDeletedEvent())

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { plan: true },
      })
      expect(user?.plan).toBe('FREE')
    })

    it('sets subscriptionStatus to canceled', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeSubscriptionDeletedEvent())

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { subscriptionStatus: true },
      })
      expect(user?.subscriptionStatus).toBe('canceled')
    })

    it('does NOT delete the User record', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeSubscriptionDeletedEvent())

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({ where: { clerkId: TEST_CLERK_ID_A } })
      expect(user).not.toBeNull()
    })

    it('does NOT clear hasEverSubscribed', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeSubscriptionDeletedEvent())

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { hasEverSubscribed: true },
      })
      expect(user?.hasEverSubscribed).toBe(true)
    })
  })

  describe('invoice.payment_failed', () => {
    beforeEach(async () => {
      await prisma.user.update({
        where: { clerkId: TEST_CLERK_ID_A },
        data: { plan: 'PREMIUM', subscriptionStatus: 'active', hasEverSubscribed: true },
      })
    })

    it('sets subscriptionStatus to past_due', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeInvoicePaymentFailedEvent())

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { subscriptionStatus: true },
      })
      expect(user?.subscriptionStatus).toBe('past_due')
    })

    it('does NOT change plan', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeInvoicePaymentFailedEvent())

      await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { plan: true },
      })
      expect(user?.plan).toBe('PREMIUM')
    })
  })

  describe('checkout.session.completed — per-feature top-up', () => {
    function makeTopUpEvent(clerkId: string, feature: string, additionalCap: number) {
      return {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {
              type: 'topup',
              userId: clerkId,
              feature,
              additionalCap: String(additionalCap),
              periodKey: getPeriodKey(),
            },
          },
        },
      }
    }

    afterEach(async () => {
      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { id: true },
      })
      if (user) await prisma.capBoost.deleteMany({ where: { userId: user.id } })
    })

    it('creates a CapBoost raising the period cap for the feature', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeTopUpEvent(TEST_CLERK_ID_A, 'messageAnalysis', 5)
      )

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { id: true },
      })
      const boost = await prisma.capBoost.findFirst({
        where: { userId: user!.id, feature: 'messageAnalysis', periodKey: getPeriodKey() },
      })
      expect(boost).not.toBeNull()
      expect(boost?.additionalCap).toBe(5)
    })

    it('ignores a top-up with an unknown feature', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeTopUpEvent(TEST_CLERK_ID_A, 'notAFeature', 5)
      )

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { id: true },
      })
      const boost = await prisma.capBoost.findFirst({ where: { userId: user!.id } })
      expect(boost).toBeNull()
    })
  })

  describe('invoice.payment_succeeded', () => {
    it('sets subscriptionStatus to active', async () => {
      await prisma.user.update({
        where: { clerkId: TEST_CLERK_ID_A },
        data: { subscriptionStatus: 'past_due' },
      })
      mockStripe.webhooks.constructEvent.mockReturnValue(makeInvoicePaymentSucceededEvent())

      const res = await api()
        .post('/api/stripe/webhook')
        .set('stripe-signature', 'valid-sig')
        .send('{}')
      expect(res.status).toBe(200)

      const user = await prisma.user.findUnique({
        where: { clerkId: TEST_CLERK_ID_A },
        select: { subscriptionStatus: true },
      })
      expect(user?.subscriptionStatus).toBe('active')
    })
  })
})

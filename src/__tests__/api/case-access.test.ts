/**
 * case-access.test.ts — CaseAccess revocation contract test (security sweep B4.3)
 *
 * Security Posture (CONTEXT.md, ADR-006): revoking a professional's CaseAccess
 * grant must invalidate their Clerk session IMMEDIATELY — not merely on their
 * next login attempt. This smoke test asserts the revocation route revokes every
 * active Clerk session for the professional at the moment of revocation.
 *
 * Clerk is fully mocked: auth() for the acting Parent, and clerkClient() exposing
 * sessions.getSessionList / sessions.revokeSession so we can assert the immediate
 * revocation without a real Clerk call. Resend is mocked so module load is inert
 * (the route skips the email under MOCK_AI=true anyway).
 */

import { vi } from 'vitest'

const mockGetSessionList = vi.fn()
const mockRevokeSession = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(async () => ({
    sessions: {
      getSessionList: mockGetSessionList,
      revokeSession: mockRevokeSession,
    },
  })),
}))

// A regular `function` (not an arrow) is required: this mock is invoked via
// `new Resend(...)` in the route under test.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: vi.fn().mockResolvedValue({}) } }
  }),
}))

import { api } from '../helpers/client'
import { setAuthUser, TEST_CLERK_ID_A } from '../helpers/auth'
import { prisma } from '@/lib/prisma'

const PROFESSIONAL_CLERK_ID = 'test_clerk_professional_revoke'

let ownerUserId: string
let caseId: string
let accessId: string

beforeEach(async () => {
  mockGetSessionList.mockReset()
  mockRevokeSession.mockReset()
  mockRevokeSession.mockResolvedValue({})

  const owner = await prisma.user.findUnique({ where: { clerkId: TEST_CLERK_ID_A } })
  if (!owner) throw new Error('TEST_CLERK_ID_A user missing — globalSetup did not run')
  ownerUserId = owner.id

  const case_ = await prisma.case.create({
    data: { userId: ownerUserId, caseTitle: 'B4.3 Revocation Smoke Test Case' },
  })
  caseId = case_.id

  const grant = await prisma.caseAccess.create({
    data: {
      caseId,
      role: 'ATTORNEY',
      status: 'ACTIVE',
      inviteEmail: 'revoke-smoke@example.com',
      professionalId: PROFESSIONAL_CLERK_ID,
      grantedAt: new Date(),
    },
  })
  accessId = grant.id
})

afterEach(async () => {
  await prisma.caseAccess.deleteMany({ where: { caseId } })
  await prisma.case.deleteMany({ where: { id: caseId } })
})

describe('PATCH /api/cases/[caseId]/access/[accessId] — revocation', () => {
  it('invalidates every active Clerk session for the professional immediately', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    mockGetSessionList.mockResolvedValue({
      data: [{ id: 'sess_active_1' }, { id: 'sess_active_2' }],
    })

    const res = await api()
      .patch(`/api/cases/${caseId}/access/${accessId}`)
      .send({ status: 'REVOKED' })

    expect(res.status).toBe(200)

    // Sessions were looked up for THIS professional and every one revoked NOW —
    // not deferred to next login.
    expect(mockGetSessionList).toHaveBeenCalledWith({ userId: PROFESSIONAL_CLERK_ID })
    expect(mockRevokeSession).toHaveBeenCalledTimes(2)
    expect(mockRevokeSession).toHaveBeenCalledWith('sess_active_1')
    expect(mockRevokeSession).toHaveBeenCalledWith('sess_active_2')

    // DB grant is flipped to REVOKED with a revocation timestamp (chain-of-custody).
    const grant = await prisma.caseAccess.findUnique({ where: { id: accessId } })
    expect(grant?.status).toBe('REVOKED')
    expect(grant?.revokedAt).not.toBeNull()
  })
})

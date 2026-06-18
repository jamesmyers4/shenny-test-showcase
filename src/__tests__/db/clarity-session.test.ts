/**
 * clarity-session.test.ts — DB integration tests: ClaritySession & ClarityMessage cascade behavior
 *
 * Bypasses HTTP entirely. Imports Prisma directly and asserts on the real
 * the test database. Per ADR-015, a ClaritySession belongs to a
 * User and a ClarityMessage belongs to a ClaritySession — deleting a session
 * must clean up its messages, and deleting a user must clean up their
 * sessions and messages.
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A } from '../globalSetup'
import { userFactory } from '../helpers/factories'

let userAId: string

beforeAll(async () => {
  const userA = await prisma.user.findUnique({
    where: { clerkId: TEST_CLERK_ID_A },
    select: { id: true },
  })
  if (!userA) throw new Error(`Test user not found: ${TEST_CLERK_ID_A}`)
  userAId = userA.id
})

const createdSessionIds: string[] = []
const createdUserIds: string[] = []

afterEach(async () => {
  for (const id of createdSessionIds.splice(0)) {
    await prisma.claritySession.deleteMany({ where: { id } })
  }
  for (const id of createdUserIds.splice(0)) {
    await prisma.user.deleteMany({ where: { id } })
  }
})

describe('ClaritySession', () => {
  it('is created with correct fields', async () => {
    const session = await prisma.claritySession.create({
      data: { userId: userAId, title: 'Co-parenting schedule question' },
    })
    createdSessionIds.push(session.id)

    expect(session.id).toEqual(expect.any(String))
    expect(session.userId).toBe(userAId)
    expect(session.title).toBe('Co-parenting schedule question')
    expect(session.createdAt).toBeInstanceOf(Date)
    expect(session.updatedAt).toBeInstanceOf(Date)
  })
})

describe('ClarityMessage', () => {
  it('is created linked to a session', async () => {
    const session = await prisma.claritySession.create({
      data: { userId: userAId, title: 'Drafting a response' },
    })
    createdSessionIds.push(session.id)

    const message = await prisma.clarityMessage.create({
      data: { sessionId: session.id, role: 'USER', content: 'How should I word this email?' },
    })

    expect(message.sessionId).toBe(session.id)
    expect(message.role).toBe('USER')
    expect(message.content).toBe('How should I word this email?')
  })
})

describe('Cascade delete behavior', () => {
  it('deleting a ClaritySession cascades to its ClarityMessages', async () => {
    const session = await prisma.claritySession.create({
      data: { userId: userAId, title: 'Session with messages' },
    })
    createdSessionIds.push(session.id)

    await prisma.clarityMessage.create({
      data: { sessionId: session.id, role: 'USER', content: 'First message' },
    })
    await prisma.clarityMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: 'Second message' },
    })

    await prisma.claritySession.delete({ where: { id: session.id } })

    const remaining = await prisma.clarityMessage.findMany({ where: { sessionId: session.id } })
    expect(remaining).toHaveLength(0)
  })

  it('deleting a user cascades to their ClaritySessions', async () => {
    const user = await prisma.user.create({
      data: userFactory(`test_clerk_clarity_session_cascade_${Date.now()}`),
    })
    createdUserIds.push(user.id)

    await prisma.claritySession.create({
      data: { userId: user.id, title: 'A session for a soon-to-be-deleted user' },
    })

    await prisma.user.delete({ where: { id: user.id } })

    const remaining = await prisma.claritySession.findMany({ where: { userId: user.id } })
    expect(remaining).toHaveLength(0)
  })

  it('deleting a user cascades to their ClarityMessages via session cascade', async () => {
    const user = await prisma.user.create({
      data: userFactory(`test_clerk_clarity_message_cascade_${Date.now()}`),
    })
    createdUserIds.push(user.id)

    const session = await prisma.claritySession.create({
      data: { userId: user.id, title: 'Session for cascade-via-session test' },
    })

    const message = await prisma.clarityMessage.create({
      data: { sessionId: session.id, role: 'USER', content: 'This message should cascade away' },
    })

    await prisma.user.delete({ where: { id: user.id } })

    const refetched = await prisma.clarityMessage.findUnique({ where: { id: message.id } })
    expect(refetched).toBeNull()
  })
})

describe('Multiple sessions per user', () => {
  it('are independent', async () => {
    const sessionOne = await prisma.claritySession.create({
      data: { userId: userAId, title: 'First independent session' },
    })
    createdSessionIds.push(sessionOne.id)

    const sessionTwo = await prisma.claritySession.create({
      data: { userId: userAId, title: 'Second independent session' },
    })
    createdSessionIds.push(sessionTwo.id)

    await prisma.claritySession.delete({ where: { id: sessionOne.id } })

    const stillExists = await prisma.claritySession.findUnique({ where: { id: sessionTwo.id } })
    expect(stillExists).not.toBeNull()
  })
})

describe('ClarityMessageRole enum', () => {
  it('USER and ASSISTANT values are enforced', async () => {
    const session = await prisma.claritySession.create({
      data: { userId: userAId, title: 'Role enum check' },
    })
    createdSessionIds.push(session.id)

    const userMessage = await prisma.clarityMessage.create({
      data: { sessionId: session.id, role: 'USER', content: 'A message from the parent' },
    })
    expect(userMessage.role).toBe('USER')

    const assistantMessage = await prisma.clarityMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: 'A reply from Clarity' },
    })
    expect(assistantMessage.role).toBe('ASSISTANT')
  })
})

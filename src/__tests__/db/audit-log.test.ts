/**
 * audit-log.test.ts — DB integration tests: AuditLog
 *
 * Bypasses HTTP entirely. Imports Prisma directly and asserts on the real
 * the test database. AuditLog is the chain-of-custody record for
 * sensitive mutations — these tests verify the model itself stores and
 * returns data correctly, not that every route writes a row (that belongs
 * in the API layer).
 */

import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A, TEST_CLERK_ID_B } from '../globalSetup'

let userAId: string
let userBId: string

beforeAll(async () => {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({ where: { clerkId: TEST_CLERK_ID_A }, select: { id: true } }),
    prisma.user.findUnique({ where: { clerkId: TEST_CLERK_ID_B }, select: { id: true } }),
  ])
  if (!userA) throw new Error(`Test user not found: ${TEST_CLERK_ID_A}`)
  if (!userB) throw new Error(`Test user not found: ${TEST_CLERK_ID_B}`)
  userAId = userA.id
  userBId = userB.id
})

const createdAuditLogIds: string[] = []

afterEach(async () => {
  for (const id of createdAuditLogIds.splice(0)) {
    await prisma.auditLog.deleteMany({ where: { id } })
  }
})

describe('AuditLog', () => {
  it('stores action, tableName, recordId correctly', async () => {
    const log = await prisma.auditLog.create({
      data: {
        userId: userAId,
        action: 'UPDATE',
        tableName: 'Entry',
        recordId: 'test-id-123',
      },
    })
    createdAuditLogIds.push(log.id)

    const refetched = await prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } })

    expect(refetched.action).toBe('UPDATE')
    expect(refetched.tableName).toBe('Entry')
    expect(refetched.recordId).toBe('test-id-123')
  })

  it('stores before and after snapshots as JSON', async () => {
    const log = await prisma.auditLog.create({
      data: {
        userId: userAId,
        action: 'UPDATE',
        tableName: 'Entry',
        recordId: 'test-id-456',
        before: { title: 'old' },
        after: { title: 'new' },
      },
    })
    createdAuditLogIds.push(log.id)

    const refetched = await prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } })

    expect(refetched.before).toEqual({ title: 'old' })
    expect(refetched.after).toEqual({ title: 'new' })
  })

  it('userId is nullable — system actions store without a user', async () => {
    const log = await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'UPDATE',
        tableName: 'User',
        recordId: 'system-action-1',
      },
    })
    createdAuditLogIds.push(log.id)

    expect(log.userId).toBeNull()
  })

  it('rows are queryable by userId', async () => {
    const logA1 = await prisma.auditLog.create({
      data: { userId: userAId, action: 'UPDATE', tableName: 'Entry', recordId: 'a-1' },
    })
    createdAuditLogIds.push(logA1.id)

    const logA2 = await prisma.auditLog.create({
      data: { userId: userAId, action: 'UPDATE', tableName: 'Entry', recordId: 'a-2' },
    })
    createdAuditLogIds.push(logA2.id)

    const logB = await prisma.auditLog.create({
      data: { userId: userBId, action: 'UPDATE', tableName: 'Entry', recordId: 'b-1' },
    })
    createdAuditLogIds.push(logB.id)

    const results = await prisma.auditLog.findMany({ where: { userId: userAId } })

    expect(results).toHaveLength(2)
  })

  it('rows are queryable by action', async () => {
    const created = await prisma.auditLog.create({
      data: { userId: userAId, action: 'CREATE', tableName: 'Entry', recordId: 'create-1' },
    })
    createdAuditLogIds.push(created.id)

    const deleted = await prisma.auditLog.create({
      data: { userId: userAId, action: 'DELETE', tableName: 'Entry', recordId: 'delete-1' },
    })
    createdAuditLogIds.push(deleted.id)

    const results = await prisma.auditLog.findMany({ where: { action: 'DELETE' } })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(deleted.id)
  })

  it('stores createdByIp and userAgent when provided', async () => {
    const log = await prisma.auditLog.create({
      data: {
        userId: userAId,
        action: 'UPDATE',
        tableName: 'Entry',
        recordId: 'test-id-789',
        createdByIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
    })
    createdAuditLogIds.push(log.id)

    const refetched = await prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } })

    expect(refetched.createdByIp).toBe('127.0.0.1')
    expect(refetched.userAgent).toBe('test-agent')
  })
})

/**
 * export.test.ts — Export API contract tests
 *
 * Verifies: no date range (all entries), date-filtered range, and partial
 * date validation (400 when only one date is supplied).
 *
 * Storage (R2) and export file generators are mocked so no real uploads
 * or file generation occur during tests.
 */

import { vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

vi.mock('@/lib/storage', () => ({
  generateExportStorageKey: vi.fn(() => 'test-export-key/export.xlsx'),
  uploadObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue('https://mock-export-url.example.com/export.xlsx'),
}))

vi.mock('@/lib/export/generateXlsx', () => ({
  generateXlsx: vi.fn().mockResolvedValue(Buffer.from('mock-xlsx')),
}))

vi.mock('@/lib/export/generatePdf', () => ({
  generatePdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
}))

import { api } from '../helpers/client'
import { setAuthUser, clearAuth, TEST_CLERK_ID_A } from '../helpers/auth'
import { prisma } from '@/lib/prisma'

const createdEntryIds: string[] = []
const createdExportIds: string[] = []

async function getUserId(clerkId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) throw new Error(`Test user not found: ${clerkId}`)
  return user.id
}

beforeAll(async () => {
  // Seed two finalized entries at different dates for filter tests
  const userId = await getUserId(TEST_CLERK_ID_A)
  const e1 = await prisma.entry.create({
    data: {
      userId,
      entryDate: new Date('2024-01-15'),
      title: 'Export test entry Jan',
      category: 'INCIDENT',
      summary: 'January test entry',
      isDraft: false,
    },
  })
  const e2 = await prisma.entry.create({
    data: {
      userId,
      entryDate: new Date('2024-06-20'),
      title: 'Export test entry June',
      category: 'INCIDENT',
      summary: 'June test entry',
      isDraft: false,
    },
  })
  createdEntryIds.push(e1.id, e2.id)
})

afterAll(async () => {
  for (const id of createdEntryIds) {
    try {
      await prisma.auditLog.deleteMany({ where: { entryId: id } })
      await prisma.entry.deleteMany({ where: { id } })
    } catch {
      // already cleaned
    }
  }
  for (const id of createdExportIds) {
    try {
      await prisma.auditLog.deleteMany({ where: { recordId: id } })
      await prisma.exportHistory.deleteMany({ where: { id } })
    } catch {
      // already cleaned
    }
  }
})

// ─── POST /api/export — no date range ─────────────────────────────────────

describe('POST /api/export with no date range', () => {
  it('returns 200 and exports all entries', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/export').send({ format: 'XLSX' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ url: expect.any(String), exportId: expect.any(String) })
    createdExportIds.push(res.body.exportId as string)
  })
})

// ─── POST /api/export — with date range ───────────────────────────────────

describe('POST /api/export with startDate and endDate', () => {
  it('returns 200 when both dates are provided', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api()
      .post('/api/export')
      .send({ format: 'XLSX', filters: { dateFrom: '2024-01-01', dateTo: '2024-03-31' } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ url: expect.any(String), exportId: expect.any(String) })
    createdExportIds.push(res.body.exportId as string)
  })
})

// ─── POST /api/export — partial date validation ────────────────────────────

describe('POST /api/export with partial date range', () => {
  it('returns 400 when only startDate (dateFrom) is provided', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api()
      .post('/api/export')
      .send({ format: 'XLSX', filters: { dateFrom: '2024-01-01' } })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('returns 400 when only endDate (dateTo) is provided', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api()
      .post('/api/export')
      .send({ format: 'XLSX', filters: { dateTo: '2024-03-31' } })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})

// ─── POST /api/export — auth ───────────────────────────────────────────────

describe('POST /api/export auth', () => {
  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().post('/api/export').send({ format: 'XLSX' })
    expect(res.status).toBe(401)
  })
})

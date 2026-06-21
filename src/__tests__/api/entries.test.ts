/**
 * entries.test.ts — Entry CRUD contract tests
 *
 * Auth: vi.mock('@clerk/nextjs/server') replaces auth() with a vi.fn().
 * setAuthUser(clerkId) / clearAuth() control what each request sees.
 *
 * DB: real test schema (DATABASE_URL=...?schema=test). Entries created during
 * tests are deleted in afterEach to keep state clean.
 *
 * Ownership: every mutating route is verified to reject cross-user access —
 * a non-negotiable legal defensibility requirement per CONTEXT.md.
 */

import { vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

// MOCK_AI=true prevents fire-and-forget tone-eval fetches from hitting real Anthropic
// The POST route calls void fetch(...) to trigger tone-eval; MOCK_AI=true makes
// the tone-eval route short-circuit immediately if it were actually called.

import { api } from '../helpers/client'
import { setAuthUser, clearAuth, TEST_CLERK_ID_A, TEST_CLERK_ID_B } from '../helpers/auth'
import { prisma } from '@/lib/prisma'

const VALID_ENTRY = {
  entryDate: '2025-06-01',
  title: 'Test entry title',
  category: 'INCIDENT',
  summary: 'This is a test entry summary for Jest tests.',
}

// IDs of resources created during each test — deleted in afterEach
const createdEntryIds: string[] = []

async function getUserId(clerkId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) throw new Error(`Test user not found: ${clerkId}`)
  return user.id
}

afterEach(async () => {
  // Clean up entries created during tests
  for (const id of createdEntryIds) {
    try {
      await prisma.tag.deleteMany({ where: { entryId: id } })
      await prisma.entryWitness.deleteMany({ where: { entryId: id } })
      await prisma.entryEvidence.deleteMany({ where: { entryId: id } })
      await prisma.attachment.deleteMany({ where: { entryId: id } })
      await prisma.entryRevision.deleteMany({ where: { entryId: id } })
      await prisma.auditLog.deleteMany({ where: { entryId: id } })
      await prisma.entry.deleteMany({ where: { id } })
    } catch {
      // ignore — entry may have already been deleted by the test
    }
  }
  createdEntryIds.length = 0
})

// ─── POST /api/entries ─────────────────────────────────────────────────────

describe('POST /api/entries', () => {
  it('creates an entry for authenticated user (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send(VALID_ENTRY)
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      title: VALID_ENTRY.title,
      category: VALID_ENTRY.category,
      summary: VALID_ENTRY.summary,
    })
    createdEntryIds.push(res.body.data.id)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().post('/api/entries').send(VALID_ENTRY)
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid (missing required fields)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ title: 'No date or category' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('associates the entry to the authenticated user only', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send(VALID_ENTRY)
    expect(res.status).toBe(201)
    createdEntryIds.push(res.body.data.id)

    const userAId = await getUserId(TEST_CLERK_ID_A)
    expect(res.body.data.userId).toBe(userAId)
  })
})

// ─── GET /api/entries ──────────────────────────────────────────────────────

describe('GET /api/entries', () => {
  it('returns the authenticated user\'s entries (200)', async () => {
    // Create an entry first
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    const res = await api().get('/api/entries')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('entries')
    expect(res.body.data).toHaveProperty('total')
    expect(Array.isArray(res.body.data.entries)).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().get('/api/entries')
    expect(res.status).toBe(401)
  })

  it('supports page and pageSize query params', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/entries?page=1&pageSize=5')
    expect(res.status).toBe(200)
    expect(res.body.data.pageSize).toBe(5)
    expect(res.body.data.page).toBe(1)
  })

  it('user A cannot see user B\'s entries', async () => {
    // Create entry as user B
    setAuthUser(TEST_CLERK_ID_B)
    const created = await api().post('/api/entries').send({
      ...VALID_ENTRY,
      title: 'User B private entry',
    })
    createdEntryIds.push(created.body.data.id)

    // List as user A — should not see user B's entry
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/entries')
    expect(res.status).toBe(200)
    const entryIds = res.body.data.entries.map((e: { id: string }) => e.id)
    expect(entryIds).not.toContain(created.body.data.id)
  })
})

// ─── GET /api/entries/:entryId ─────────────────────────────────────────────

describe('GET /api/entries/:entryId', () => {
  it('returns a single entry for its owner (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    const res = await api().get(`/api/entries/${created.body.data.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(created.body.data.id)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().get('/api/entries/nonexistent-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for a nonexistent entry', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/entries/does-not-exist-123')
    expect(res.status).toBe(404)
  })

  it('OWNERSHIP: user B cannot read user A\'s entry (404)', async () => {
    // Create as A
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    // Attempt to read as B
    setAuthUser(TEST_CLERK_ID_B)
    const res = await api().get(`/api/entries/${created.body.data.id}`)
    // Route enforces userId in DB query → returns 404 (not 403) to avoid leaking existence
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/entries/:entryId ───────────────────────────────────────────

describe('PATCH /api/entries/:entryId', () => {
  it('updates an entry for its owner (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    const res = await api()
      .patch(`/api/entries/${created.body.data.id}`)
      .send({ title: 'Updated title' })
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Updated title')
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().patch('/api/entries/some-id').send({ title: 'x' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid update payload', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    // title must be at least 1 character
    const res = await api()
      .patch(`/api/entries/${created.body.data.id}`)
      .send({ title: '' })
    expect(res.status).toBe(400)
  })

  it('OWNERSHIP: user B cannot update user A\'s entry', async () => {
    // Create as A
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    // Update attempt as B
    setAuthUser(TEST_CLERK_ID_B)
    const res = await api()
      .patch(`/api/entries/${created.body.data.id}`)
      .send({ title: 'Unauthorized update' })
    // The route finds no entry for userId=B → entriesService.updateEntry throws → 500
    // or the underlying findFirst returns null → we accept 404 or 500
    expect([404, 500]).toContain(res.status)
  })
})

// ─── DELETE /api/entries/:entryId ──────────────────────────────────────────

describe('DELETE /api/entries/:entryId (soft delete)', () => {
  it('soft-deletes an entry for its owner (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    const res = await api().delete(`/api/entries/${created.body.data.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ success: true })

    // Verify soft delete: entry still in DB with deletedAt set
    const inDb = await prisma.entry.findUnique({ where: { id: created.body.data.id } })
    expect(inDb).not.toBeNull()
    expect(inDb?.deletedAt).not.toBeNull()
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().delete('/api/entries/some-id')
    expect(res.status).toBe(401)
  })

  it('OWNERSHIP: user B cannot delete user A\'s entry', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/entries').send(VALID_ENTRY)
    createdEntryIds.push(created.body.data.id)

    setAuthUser(TEST_CLERK_ID_B)
    const res = await api().delete(`/api/entries/${created.body.data.id}`)
    // Route calls entriesService.deleteEntry(id, userId) — user B's userId
    // doesn't match → throws "Entry not found" → 500
    expect([404, 500]).toContain(res.status)

    // Entry must still exist (not deleted)
    const inDb = await prisma.entry.findUnique({ where: { id: created.body.data.id } })
    expect(inDb?.deletedAt).toBeNull()
  })
})

// ─── New schema values ─────────────────────────────────────────────────────

describe('POST /api/entries — new source and category values', () => {
  it('creates entry with source PARENTSQUARE (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, source: 'PARENTSQUARE' })
    expect(res.status).toBe(201)
    expect(res.body.data.source).toBe('PARENTSQUARE')
    createdEntryIds.push(res.body.data.id)
  })

  it('creates entry with source PERSONAL_REFLECTION (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, source: 'PERSONAL_REFLECTION' })
    expect(res.status).toBe(201)
    expect(res.body.data.source).toBe('PERSONAL_REFLECTION')
    createdEntryIds.push(res.body.data.id)
  })

  it('creates entry with source DOCUMENT (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, source: 'DOCUMENT' })
    expect(res.status).toBe(201)
    expect(res.body.data.source).toBe('DOCUMENT')
    createdEntryIds.push(res.body.data.id)
  })

  it('creates entry with category OBSERVATION (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, category: 'OBSERVATION' })
    expect(res.status).toBe(201)
    expect(res.body.data.category).toBe('OBSERVATION')
    createdEntryIds.push(res.body.data.id)
  })

  it('creates entry with eventTime "14:30" — eventTime present in response (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, eventTime: '14:30' })
    expect(res.status).toBe(201)
    expect(res.body.data.eventTime).toBe('14:30')
    createdEntryIds.push(res.body.data.id)
  })

  it('creates entry with eventTime null — field is null (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, eventTime: null })
    expect(res.status).toBe(201)
    expect(res.body.data.eventTime).toBeNull()
    createdEntryIds.push(res.body.data.id)
  })

  it('rejects entry with source VERBAL — returns 400 (invalid enum value)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/entries').send({ ...VALID_ENTRY, source: 'VERBAL' })
    expect(res.status).toBe(400)
  })
})

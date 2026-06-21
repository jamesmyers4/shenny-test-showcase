/**
 * recordings.test.ts — Recording contract tests
 *
 * The recordings routes call into R2 (presigned URL generation). Both
 * @/lib/storage and @/lib/storage/getPresignedUrl are mocked so no real
 * S3 calls are made. The Recording record itself is written to the real
 * test DB so ownership enforcement is exercised.
 */

import { vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

vi.mock('@/lib/storage', () => ({
  generateRecordingStorageKey: vi.fn(
    (_userId: string, fileName: string) => `test-storage-key/${fileName}`
  ),
  getPresignedUploadUrl: vi.fn().mockResolvedValue('https://mock-upload-url.example.com/upload'),
  getPresignedUrl: vi.fn().mockResolvedValue('https://mock-presigned-url.example.com/file'),
}))

vi.mock('@/lib/storage/getPresignedUrl', () => ({
  getPresignedUrl: vi.fn().mockResolvedValue('https://mock-presigned-url.example.com/file'),
}))

import { api } from '../helpers/client'
import { setAuthUser, clearAuth, TEST_CLERK_ID_A, TEST_CLERK_ID_B } from '../helpers/auth'
import { prisma } from '@/lib/prisma'

const VALID_RECORDING = {
  fileName: 'test-recording.mp3',
  fileSize: 1024 * 512, // 512 KB
  mimeType: 'audio/mpeg',
  recordedAt: new Date('2025-06-01T10:00:00Z').toISOString(),
}

const createdRecordingIds: string[] = []

afterEach(async () => {
  for (const id of createdRecordingIds) {
    try {
      await prisma.recordingTranscript.deleteMany({ where: { recordingId: id } })
      await prisma.recordingReport.deleteMany({ where: { recordingId: id } })
      await prisma.caseItem.deleteMany({ where: { recordingId: id } })
      await prisma.recording.deleteMany({ where: { id } })
    } catch {
      // already cleaned
    }
  }
  createdRecordingIds.length = 0
})

// ─── POST /api/recordings ─────────────────────────────────────────────────

describe('POST /api/recordings', () => {
  it('initiates an upload for authenticated user (201)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().post('/api/recordings').send(VALID_RECORDING)
    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('recording')
    expect(res.body.data).toHaveProperty('uploadUrl')
    expect(res.body.data.recording.status).toBe('UPLOADING')
    createdRecordingIds.push(res.body.data.recording.id)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().post('/api/recordings').send(VALID_RECORDING)
    expect(res.status).toBe(401)
  })

  it('returns 400 when fileName is missing', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const { fileName: _fn, ...withoutFileName } = VALID_RECORDING
    const res = await api().post('/api/recordings').send(withoutFileName)
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when fileSize is missing', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const { fileSize: _fs, ...withoutSize } = VALID_RECORDING
    const res = await api().post('/api/recordings').send(withoutSize)
    expect(res.status).toBe(400)
  })

  it('returns 400 when mimeType is missing', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const { mimeType: _mt, ...withoutMime } = VALID_RECORDING
    const res = await api().post('/api/recordings').send(withoutMime)
    expect(res.status).toBe(400)
  })
})

// ─── GET /api/recordings ──────────────────────────────────────────────────

describe('GET /api/recordings', () => {
  it('returns the authenticated user\'s recordings (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/recordings').send(VALID_RECORDING)
    createdRecordingIds.push(created.body.data.recording.id)

    const res = await api().get('/api/recordings')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().get('/api/recordings')
    expect(res.status).toBe(401)
  })

  it('user A cannot see user B\'s recordings', async () => {
    setAuthUser(TEST_CLERK_ID_B)
    const created = await api().post('/api/recordings').send(VALID_RECORDING)
    createdRecordingIds.push(created.body.data.recording.id)

    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/recordings')
    expect(res.status).toBe(200)
    const ids = res.body.data.map((r: { id: string }) => r.id)
    expect(ids).not.toContain(created.body.data.recording.id)
  })
})

// ─── GET /api/recordings/:id ──────────────────────────────────────────────

describe('GET /api/recordings/:id', () => {
  it('returns a single recording for its owner (200)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/recordings').send(VALID_RECORDING)
    createdRecordingIds.push(created.body.data.recording.id)

    const res = await api().get(`/api/recordings/${created.body.data.recording.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(created.body.data.recording.id)
  })

  it('returns 401 when unauthenticated', async () => {
    clearAuth()
    const res = await api().get('/api/recordings/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for nonexistent recording', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const res = await api().get('/api/recordings/does-not-exist-999')
    expect(res.status).toBe(404)
  })

  it('OWNERSHIP: user B cannot read user A\'s recording (404)', async () => {
    setAuthUser(TEST_CLERK_ID_A)
    const created = await api().post('/api/recordings').send(VALID_RECORDING)
    createdRecordingIds.push(created.body.data.recording.id)

    setAuthUser(TEST_CLERK_ID_B)
    const res = await api().get(`/api/recordings/${created.body.data.recording.id}`)
    // Route uses userId in the where clause — returns 404 for wrong owner
    expect(res.status).toBe(404)
  })
})

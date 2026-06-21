/**
 * import-pipeline.test.ts — import AI-routing contract (Session 2)
 *
 * Proves the import pipeline routes its AI work through the @/lib/ai
 * abstraction (which honors the AI_PROVIDER toggle) rather than a direct
 * Anthropic client:
 *   - column-mapping + category inference go through `runAiPrompt`
 *   - ToneEval / EntrySplit batch submission goes through `createClaudeBatch`
 *
 * @/lib/ai is mocked so we can spy on those calls. MOCK_AI is forced off for
 * this file so the inference helpers actually reach `runAiPrompt` (their
 * MOCK_AI early-return would otherwise skip it). The long rate-limit sleeps
 * inside the batch phase are skipped so the test runs fast.
 */

import { vi, type MockInstance } from 'vitest'

// @/lib/ai/importJob is imported statically below, which statically imports
// @/lib/ai — so this mock factory runs while evaluating the test file's own
// imports, before the `const mock... = vi.fn()` declarations would otherwise
// initialize. vi.hoisted() runs first so the factory can reference them.
const { mockRunAiPrompt, mockCreateClaudeBatch, mockGetObjectBuffer } = vi.hoisted(() => ({
  mockRunAiPrompt: vi.fn(),
  mockCreateClaudeBatch: vi.fn(),
  mockGetObjectBuffer: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  runAiPrompt: mockRunAiPrompt,
  createClaudeBatch: mockCreateClaudeBatch,
}))

vi.mock('@/lib/storage', () => ({
  getObjectBuffer: (...args: unknown[]) => mockGetObjectBuffer(...args),
}))

// Keep the completion/failure emails from hitting the network once MOCK_AI is off.
// A regular `function` (not an arrow) is required: this mock is invoked via
// `new Resend(...)` in @/lib/ai/importJob.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: vi.fn().mockResolvedValue({}) } }
  }),
}))

import { runImportPipeline } from '@/lib/ai/importJob'
import { prisma } from '@/lib/prisma'
import { TEST_CLERK_ID_A } from '../helpers/auth'

const CSV = 'Date,Title,Notes\n2025-06-01,Custody exchange,Notes about the exchange\n'

const COLUMN_MAPPING = JSON.stringify({
  date: 'Date',
  time: null,
  title: 'Title',
  notes: 'Notes',
  category: null,
  source: null,
  witnesses: null,
  evidence: null,
})

let originalMockAi: string | undefined
let setTimeoutSpy: MockInstance
const createdJobIds: string[] = []

beforeAll(() => {
  // Force the AI calls down the real runAiPrompt path (skip the MOCK_AI guard
  // inside the inference helpers).
  originalMockAi = process.env.MOCK_AI
  process.env.MOCK_AI = 'false'

  // Skip the long inter-batch rate-limit sleeps (>= 60s) so the test is fast;
  // keep short timers real so nothing else is disturbed.
  const realSetTimeout = global.setTimeout
  setTimeoutSpy = vi
    .spyOn(global, 'setTimeout')
    .mockImplementation(((cb: (...a: unknown[]) => void, ms?: number) => {
      if (ms && ms >= 60_000) {
        cb()
        return 0 as unknown as NodeJS.Timeout
      }
      return realSetTimeout(cb, ms)
    }) as typeof setTimeout)
})

afterAll(() => {
  process.env.MOCK_AI = originalMockAi
  setTimeoutSpy.mockRestore()
})

beforeEach(() => {
  mockGetObjectBuffer.mockResolvedValue(Buffer.from(CSV, 'utf-8'))
  mockRunAiPrompt.mockImplementation((system: string) =>
    Promise.resolve([
      system.includes('mapping spreadsheet columns')
        ? COLUMN_MAPPING
        : JSON.stringify({ category: 'INCIDENT' }),
    ])
  )
  mockCreateClaudeBatch.mockResolvedValue('batch_test_123')
})

afterEach(async () => {
  for (const jobId of createdJobIds) {
    const entries = await prisma.entry.findMany({
      where: { importJobId: jobId },
      select: { id: true },
    })
    const entryIds = entries.map((e) => e.id)
    if (entryIds.length > 0) {
      await prisma.batchJob.deleteMany({ where: { entryId: { in: entryIds } } })
    }
    await prisma.entry.deleteMany({ where: { importJobId: jobId } })
    await prisma.importJob.deleteMany({ where: { id: jobId } })
  }
  createdJobIds.length = 0
  vi.clearAllMocks()
})

async function seedImportJob(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { clerkId: TEST_CLERK_ID_A },
    select: { id: true },
  })
  const job = await prisma.importJob.create({
    data: {
      userId: user.id,
      storageKey: 'test-import-key',
      fileName: 'import.csv',
      status: 'PENDING',
    },
    select: { id: true },
  })
  createdJobIds.push(job.id)
  return job.id
}

describe('runImportPipeline — AI provider routing', () => {
  it('routes column-mapping and category inference through runAiPrompt', async () => {
    const jobId = await seedImportJob()

    await runImportPipeline(jobId)

    expect(mockRunAiPrompt).toHaveBeenCalled()
    // The column-mapping system prompt must have gone through runAiPrompt,
    // proving the import path honors the AI_PROVIDER toggle.
    const systems = mockRunAiPrompt.mock.calls.map((c) => c[0] as string)
    expect(systems.some((s) => s.includes('mapping spreadsheet columns'))).toBe(true)
  })

  it('routes ToneEval/EntrySplit batch submission through createClaudeBatch', async () => {
    const jobId = await seedImportJob()

    await runImportPipeline(jobId)

    // One imported entry → one ToneEval batch + one EntrySplit batch.
    expect(mockCreateClaudeBatch).toHaveBeenCalled()
  })

  it('completes the job and creates the imported entry', async () => {
    const jobId = await seedImportJob()

    await runImportPipeline(jobId)

    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } })
    expect(job.status).toBe('COMPLETE')
    expect(job.entriesGenerated).toBe(1)

    const entries = await prisma.entry.findMany({ where: { importJobId: jobId } })
    expect(entries).toHaveLength(1)
    expect(entries[0].isImported).toBe(true)
  })
})

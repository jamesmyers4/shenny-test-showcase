import { test, expect } from './setup/auth'
import {
  createRecording,
  markRecordingPending,
  triggerRecordingProcess,
} from './helpers/api'
import { buildRecordingPayload } from './fixtures/recordings'

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — Recording upload: status progresses UPLOADING → PENDING → COMPLETE
//
// All external calls are mocked via MOCK_AI=true:
//   - hashStorageObject returns a fixed SHA-256 (no R2 read)
//   - getObjectBuffer returns a stub buffer (no R2 read)
//   - OpenAI Whisper is replaced with a fixture transcript
//   - generateRecordingReport creates a stub RecordingReport (no Claude call)
//   - Resend email is skipped
//
// All API calls use page.request so the Clerk session cookie is included.
// The process route is called directly with CRON_SECRET (mirrors production
// trigger behaviour from the cron job or webhook).
// ─────────────────────────────────────────────────────────────────────────────
test('recording upload — status progresses UPLOADING → PENDING → COMPLETE', async ({ page }) => {
  // Step 1: Create the recording record — status starts as UPLOADING.
  const recording = await createRecording(page.request, buildRecordingPayload())
  expect(recording.status).toBe('UPLOADING')

  // Step 2: Mark upload complete (hashes the file, moves to PENDING).
  // With MOCK_AI=true, hashStorageObject returns a fixed hash without R2 access.
  const pending = await markRecordingPending(page.request, recording.id)
  expect(pending.status).toBe('PENDING')

  // Step 3: Trigger the pipeline directly (mirrors the cron job / webhook).
  // With MOCK_AI=true: Whisper stub → transcript saved, Claude stub → report saved.
  const complete = await triggerRecordingProcess(page.request, recording.id)
  expect(complete.status).toBe('COMPLETE')
})

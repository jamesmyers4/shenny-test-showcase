import type { APIRequestContext } from '@playwright/test'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET ?? ''

// All helpers accept a `request` context — use `page.request` in tests so
// the Clerk session cookie is automatically included in every call.

export async function createRecording(
  request: APIRequestContext,
  payload: Record<string, unknown>
): Promise<{ id: string; status: string; storageKey: string; uploadUrl: string }> {
  const res = await request.post(`${BASE}/api/recordings`, { data: payload })
  if (!res.ok()) throw new Error(`createRecording failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  return { ...body.data.recording, uploadUrl: body.data.uploadUrl }
}

export async function markRecordingPending(
  request: APIRequestContext,
  recordingId: string
): Promise<{ status: string }> {
  const res = await request.patch(`${BASE}/api/recordings/${recordingId}/complete`)
  if (!res.ok()) throw new Error(`markRecordingPending failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  return body.data
}

export async function triggerRecordingProcess(
  request: APIRequestContext,
  recordingId: string
): Promise<{ status: string }> {
  const res = await request.post(`${BASE}/api/recordings/${recordingId}/process`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
  if (!res.ok()) throw new Error(`triggerRecordingProcess failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  return body.data
}

export async function getRecordingStatus(
  request: APIRequestContext,
  recordingId: string
): Promise<string> {
  const res = await request.get(`${BASE}/api/recordings`)
  if (!res.ok()) throw new Error(`getRecordingStatus failed: ${res.status()}`)
  const body = await res.json()
  const recording = (body.data as Array<{ id: string; status: string }>).find(
    (r) => r.id === recordingId
  )
  if (!recording) throw new Error(`Recording ${recordingId} not found in list`)
  return recording.status
}

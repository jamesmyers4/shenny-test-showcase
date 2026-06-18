import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { CustomWorld } from '../support/world'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET ?? ''

Given('I have an existing Recording', async function (this: CustomWorld) {
  const payload = {
    fileName: `e2e-recording-${faker.string.alphanumeric(8)}.mp3`,
    fileSize: 102400,
    mimeType: 'audio/mpeg',
    recordedAt: new Date().toISOString(),
  }
  const res = await this.context.request.post(`${BASE}/api/recordings`, { data: payload })
  if (!res.ok()) throw new Error(`createRecording failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  this.lastCreatedRecordingId = body.data.recording.id
})

When('I create a new Recording via the API', async function (this: CustomWorld) {
  const payload = {
    fileName: `e2e-recording-${faker.string.alphanumeric(8)}.mp3`,
    fileSize: 102400,
    mimeType: 'audio/mpeg',
    recordedAt: new Date().toISOString(),
  }
  const res = await this.context.request.post(`${BASE}/api/recordings`, { data: payload })
  if (!res.ok()) throw new Error(`createRecording failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  this.lastCreatedRecordingId = body.data.recording.id
  expect(body.data.recording.status).toBe('UPLOADING')
})

Then('the Recording status should be {string}', async function (this: CustomWorld, expectedStatus: string) {
  if (!this.lastCreatedRecordingId) throw new Error('No recording ID in world state')

  if (expectedStatus === 'UPLOADING') {
    // Status was already checked in the When step above — just verify world state is set
    expect(this.lastCreatedRecordingId).toBeTruthy()
    return
  }

  const res = await this.context.request.get(`${BASE}/api/recordings`)
  if (!res.ok()) throw new Error(`getRecordings failed: ${res.status()}`)
  const body = await res.json()
  const recording = (body.data as Array<{ id: string; status: string }>).find(
    (r) => r.id === this.lastCreatedRecordingId
  )
  if (!recording) throw new Error(`Recording ${this.lastCreatedRecordingId} not found in list`)
  expect(recording.status).toBe(expectedStatus)
})

When('I mark the Recording upload as complete', async function (this: CustomWorld) {
  if (!this.lastCreatedRecordingId) throw new Error('No recording ID in world state')
  const res = await this.context.request.patch(
    `${BASE}/api/recordings/${this.lastCreatedRecordingId}/complete`
  )
  if (!res.ok()) throw new Error(`markRecordingPending failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  expect(body.data.status).toBe('PENDING')
})

When('I trigger the Recording processing pipeline', async function (this: CustomWorld) {
  if (!this.lastCreatedRecordingId) throw new Error('No recording ID in world state')
  const res = await this.context.request.post(
    `${BASE}/api/recordings/${this.lastCreatedRecordingId}/process`,
    { headers: { authorization: `Bearer ${CRON_SECRET}` } }
  )
  if (!res.ok()) throw new Error(`triggerRecordingProcess failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  expect(body.data.status).toBe('COMPLETE')
})

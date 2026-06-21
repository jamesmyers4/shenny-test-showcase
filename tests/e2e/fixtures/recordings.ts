import { faker } from '@faker-js/faker'

export function buildRecordingPayload() {
  return {
    fileName: `e2e-recording-${faker.string.alphanumeric(8)}.mp3`,
    fileSize: 102400,
    mimeType: 'audio/mpeg',
    recordedAt: new Date().toISOString(),
  }
}

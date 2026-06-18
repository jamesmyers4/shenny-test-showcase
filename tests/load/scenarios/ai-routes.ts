import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'
import { Options } from 'k6/options'
import { BASE_URL, rampUp } from './config'
import { authHeaders } from './auth-helper'

// Track actual server errors separately — 402/429 are correct gating responses, not failures
const serverErrors = new Rate('ai_server_errors')

export const options: Options = {
  stages: rampUp,
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'ai_server_errors': ['rate<0.01'],
  },
}

interface SetupData {
  claritySessionId: string | null
}

export function setup(): SetupData {
  const headers = authHeaders()
  const res = http.post(
    `${BASE_URL}/api/clarity/sessions`,
    JSON.stringify({ title: 'Load test session' }),
    { headers }
  )

  if (res.status === 201) {
    const body = res.json() as { data?: { id?: string } }
    return { claritySessionId: body.data?.id ?? null }
  }

  return { claritySessionId: null }
}

const ANALYSIS_BODY = JSON.stringify({
  content:
    'Test message thread for load testing AI route response times under concurrent pressure.',
  platform: 'EMAIL',
})

const MESSAGE_BODY = JSON.stringify({
  content: 'What patterns have you noticed in my recent entries?',
})

export default function (data: SetupData) {
  const headers = authHeaders()

  // MessageAnalysis: 429 (rate_limited) and 402 (tier_required) are correct gating responses
  const analyzeRes = http.post(
    `${BASE_URL}/api/message-analysis/analyze`,
    ANALYSIS_BODY,
    { headers }
  )

  check(analyzeRes, {
    'message-analysis: gated or succeeded': (r) =>
      r.status === 200 || r.status === 402 || r.status === 429,
    'message-analysis: no server error': (r) => r.status !== 500,
  })
  serverErrors.add(analyzeRes.status >= 500)

  // Clarity: 429 (rate_limited) and 402 (tier_required) are correct gating responses
  if (data.claritySessionId) {
    const clarityRes = http.post(
      `${BASE_URL}/api/clarity/sessions/${data.claritySessionId}/messages`,
      MESSAGE_BODY,
      { headers }
    )

    check(clarityRes, {
      'clarity: gated or streamed': (r) =>
        r.status === 200 || r.status === 402 || r.status === 429,
      'clarity: no server error': (r) => r.status !== 500,
    })
    serverErrors.add(clarityRes.status >= 500)
  }

  sleep(1)
}

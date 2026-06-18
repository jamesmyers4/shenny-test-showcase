import http from 'k6/http'
import { check, sleep } from 'k6'
import { Options } from 'k6/options'
import { BASE_URL, rampUp } from './config'

export const options: Options = {
  stages: rampUp,
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'checks{type:auth_rejected}': ['rate>0.99'],
  },
}

// Three bypass strategies — missing header, malformed token, wrong auth scheme
const MODES: Record<string, string>[] = [
  {},
  { Authorization: 'Bearer not_a_valid_clerk_token' },
  { Authorization: 'Basic dXNlcjpwYXNz' },
]

// Routes safe to probe: no AI gating, return 401 without touching DB for unauthenticated requests
const ENDPOINTS = ['/api/entries', '/api/recordings', '/api/message-analysis']

export default function () {
  const modeIndex = Math.floor(Math.random() * MODES.length)
  const endpointIndex = Math.floor(Math.random() * ENDPOINTS.length)
  const extraHeaders = MODES[modeIndex]

  const res = http.get(`${BASE_URL}${ENDPOINTS[endpointIndex]}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })

  check(
    res,
    { auth_rejected: (r) => r.status === 401 },
    { type: 'auth_rejected' }
  )

  sleep(0.5)
}

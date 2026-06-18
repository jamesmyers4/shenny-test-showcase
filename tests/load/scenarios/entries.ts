import http from 'k6/http'
import { check, sleep } from 'k6'
import { Options } from 'k6/options'
import { BASE_URL, thresholds, rampUp } from './config'
import { authHeaders } from './auth-helper'

export const options: Options = {
  stages: rampUp,
  thresholds,
}

const ENTRY_BODY = JSON.stringify({
  entryDate: '2026-01-15T17:00:00Z',
  title: 'Load test entry',
  category: 'INCIDENT',
  summary:
    'Entry created during steady-state load test to verify DB and auth path performance.',
})

export default function () {
  const headers = authHeaders()

  const createRes = http.post(`${BASE_URL}/api/entries`, ENTRY_BODY, { headers })
  check(createRes, {
    'create entry 201': (r) => r.status === 201,
  })

  const listRes = http.get(`${BASE_URL}/api/entries`, { headers })
  check(listRes, {
    'list entries 200': (r) => r.status === 200,
  })

  sleep(1)
}

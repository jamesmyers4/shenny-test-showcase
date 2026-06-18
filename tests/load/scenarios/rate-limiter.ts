import http from 'k6/http'
import { check, sleep } from 'k6'
import { Options } from 'k6/options'
import { BASE_URL, spike } from './config'

export const options: Options = {
  stages: spike,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'checks{type:health_ok}': ['rate>0.99'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { type: 'health_ok' },
  })
  check(res, {
    health_ok: (r) => r.status === 200,
  })
  sleep(0.1)
}

import { Options } from 'k6/options'

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const thresholds = {
  http_req_duration: ['p(95)<500'],
  http_req_failed: ['rate<0.01'],
}

export const aiRouteThresholds = {
  http_req_duration: ['p(95)<3000'],
  http_req_failed: ['rate<0.01'],
}

export const rampUp: Options['stages'] = [
  { duration: '30s', target: 10 },
  { duration: '1m', target: 50 },
  { duration: '30s', target: 0 },
]

export const spike: Options['stages'] = [
  { duration: '10s', target: 100 },
  { duration: '30s', target: 100 },
  { duration: '10s', target: 0 },
]

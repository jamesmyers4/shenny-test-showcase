export function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${__ENV.TEST_AUTH_TOKEN}`,
  }
}

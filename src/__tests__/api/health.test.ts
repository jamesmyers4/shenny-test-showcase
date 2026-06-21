import { api } from '../helpers/client'

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await api().get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

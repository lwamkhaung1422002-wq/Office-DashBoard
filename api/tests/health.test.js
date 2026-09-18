import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'

describe('service health', () => {
  it('reports liveness without requiring the database', async () => {
    const response = await request(createApp({})).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-powered-by']).toBeUndefined()
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })

  it('reports readiness when the database responds', async () => {
    const response = await request(createApp({ $queryRaw: async () => [{ value: 1 }] })).get('/api/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ready', database: 'connected' })
  })

  it('returns 503 when the database is unavailable', async () => {
    const response = await request(createApp({ $queryRaw: async () => { throw new Error('offline') } })).get('/api/ready')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'unavailable', database: 'disconnected' })
  })
})

import supertest from 'supertest';
import { app } from './app.js';

const request = supertest(app);

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    // HealthController.ok() wraps response: { data: { status, timestamp } }
    expect(res.body).toMatchObject({ data: { status: 'ok' } });
    expect(typeof (res.body as { data: { timestamp: string } }).data.timestamp).toBe('string');
  });
});

describe('GET /unknown', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request.get('/unknown-route');
    expect(res.status).toBe(404);
  });
});

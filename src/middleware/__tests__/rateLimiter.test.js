const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const request = require('supertest');

function build429Handler() {
  return (req, res, _next, options) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  };
}

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json());

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: build429Handler()
  });

  const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.body?.phone || 'unknown'),
    handler: build429Handler()
  });

  app.get('/api/bookings', generalLimiter, (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post('/api/auth/otp', otpLimiter, (req, res) => {
    res.status(200).json({ ok: true, phone: req.body.phone });
  });

  return app;
}

describe('/api/bookings', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('allows the first 100 requests from the same IP', async () => {
    // R01
    for (let index = 0; index < 100; index += 1) {
      const response = await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.1');
      expect(response.status).not.toBe(429);
    }
  });

  test('rejects the 101st request from the same IP', async () => {
    // R02
    for (let index = 0; index < 100; index += 1) {
      await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.2');
    }

    const response = await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.2');
    expect(response.status).toBe(429);
  });

  test('returns the exact 429 response body for the 101st request', async () => {
    // R03
    for (let index = 0; index < 100; index += 1) {
      await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.3');
    }

    const response = await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.3');
    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: 'Too many requests',
      retryAfter: expect.any(Number)
    });
    expect(Object.keys(response.body)).toEqual(['error', 'retryAfter']);
  });

  test('includes X-Content-Type-Options header', async () => {
    // R07
    const response = await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.7');
    expect(response.headers['x-content-type-options']).toBeDefined();
  });

  test('includes X-Frame-Options header', async () => {
    // R08
    const response = await request(app).get('/api/bookings').set('X-Forwarded-For', '10.0.0.8');
    expect(response.headers['x-frame-options']).toBeDefined();
  });
});

describe('/api/auth/otp', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('allows five OTP requests for the same phone number', async () => {
    // R04
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post('/api/auth/otp')
        .set('X-Forwarded-For', '10.0.1.4')
        .send({ phone: '+919999999991' });
      expect(response.status).toBe(200);
    }
  });

  test('rejects the sixth OTP request for the same phone number', async () => {
    // R05
    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .post('/api/auth/otp')
        .set('X-Forwarded-For', '10.0.1.5')
        .send({ phone: '+919999999992' });
    }

    const response = await request(app)
      .post('/api/auth/otp')
      .set('X-Forwarded-For', '10.0.1.5')
      .send({ phone: '+919999999992' });

    expect(response.status).toBe(429);
  });

  test('keys OTP limits on phone number rather than IP alone', async () => {
    // R06
    for (let index = 0; index < 5; index += 1) {
      const firstPhone = await request(app)
        .post('/api/auth/otp')
        .set('X-Forwarded-For', '10.0.1.6')
        .send({ phone: '+919999999993' });
      expect(firstPhone.status).toBe(200);
    }

    for (let index = 0; index < 5; index += 1) {
      const secondPhone = await request(app)
        .post('/api/auth/otp')
        .set('X-Forwarded-For', '10.0.1.6')
        .send({ phone: '+919999999994' });
      expect(secondPhone.status).toBe(200);
    }
  });
});

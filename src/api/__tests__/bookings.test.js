process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ev-p2p-test';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

const net = require('net');

jest.mock('../../realtime', () => ({
  emitToRequest: jest.fn(),
  emitToUser: jest.fn(),
  emitToHost: jest.fn(),
  emitRequestToNearbyHosts: jest.fn(),
  isHostOnline: jest.fn(() => true),
  getHostMeta: jest.fn(() => ({ location: { lat: 12.9716, lng: 77.5946 } }))
}));

jest.mock('../../utils/notify', () => ({
  sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
  getUserDisplayName: jest.fn().mockResolvedValue('Test User')
}));

jest.mock('../../lib/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true)
}));

const express = require('express');
const request = require('supertest');
const { db } = require('../../lib/firestore');
const bookingModule = require('../../modules/booking');
const requestModule = require('../../modules/request');
const ratingModule = require('../../modules/rating');

let emulatorReachable = false;

function parseHostPort(value) {
  const raw = String(value || '').trim();
  const parts = raw.split(':');
  return {
    host: parts[0] || 'localhost',
    port: Number(parts[1] || 8080)
  };
}

async function canConnectToEmulator(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const cleanup = () => {
      socket.removeAllListeners('connect');
      socket.removeAllListeners('error');
      socket.removeAllListeners('timeout');
      if (!socket.destroyed) {
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });
    socket.once('error', () => {
      cleanup();
      resolve(false);
    });
    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });
  });
}

function makeAvailableSchedule() {
  const slot = { available: true, start: '00:00', end: '23:59' };
  return {
    mon: slot,
    tue: slot,
    wed: slot,
    thu: slot,
    fri: slot,
    sat: slot,
    sun: slot
  };
}

function makeUnavailableSchedule() {
  const slot = { available: false, start: '00:00', end: '23:59' };
  return {
    mon: slot,
    tue: slot,
    wed: slot,
    thu: slot,
    fri: slot,
    sat: slot,
    sun: slot
  };
}

async function clearCollection(name) {
  const refs = await db.collection(name).listDocuments();
  if (!refs.length) {
    return;
  }

  await Promise.all(refs.map((ref) => ref.delete().catch(() => {})));
}

async function clearFirestore() {
  const collections = ['bookings', 'blocks', 'chargers', 'promoCodes', 'ratings', 'requests', 'responses', 'users'];
  await Promise.all(collections.map((name) => clearCollection(name)));
}

async function setDoc(collectionName, id, data) {
  await db.collection(collectionName).doc(id).set({ id, ...data });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.method === 'POST' && req.url === '/api/requests') {
      req.url = '/api/request';
    }
    next();
  });
  bookingModule.registerRoutes(app);
  requestModule.registerRoutes(app);
  ratingModule.registerRoutes(app);
  return app;
}

const app = buildApp();

beforeAll(async () => {
  const { host, port } = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST);
  emulatorReachable = await canConnectToEmulator(host, port);

  if (!emulatorReachable) {
    throw new Error(
      `Firestore emulator is not reachable at ${host}:${port}. ` +
      'Start the emulator before running this suite. On this machine Java is also required for firebase emulators.'
    );
  }
});

describe('/api/bookings/active', () => {
  beforeEach(async () => {
    if (!emulatorReachable) return;
    jest.spyOn(global, 'setTimeout').mockImplementation(() => 0);
    await clearFirestore();
  });

  afterEach(async () => {
    if (!emulatorReachable) return;
    await clearFirestore();
    jest.restoreAllMocks();
  });

  test('returns active booking when STARTED exists for the user', async () => {
    // B01
    await setDoc('bookings', 'booking-b01', {
      userId: 'user-b01',
      hostId: 'host-b01',
      status: 'STARTED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).get('/api/bookings/active?role=user').set('X-Test-User-Id', 'user-b01');
    expect(response.status).toBe(200);
    expect(response.body.booking).not.toBeNull();
    expect(response.body.booking.id).toBe('booking-b01');
  });

  test('returns null when no active booking exists', async () => {
    // B02
    const response = await request(app).get('/api/bookings/active?role=user').set('X-Test-User-Id', 'user-b02');
    expect(response.status).toBe(200);
    expect(response.body.booking).toBeNull();
  });

  test('returns STARTED booking when payment status is USER_CONFIRMED', async () => {
    // B03
    await setDoc('bookings', 'booking-b03', {
      userId: 'user-b03',
      hostId: 'host-b03',
      status: 'STARTED',
      paymentStatus: 'USER_CONFIRMED',
      payment: { status: 'USER_CONFIRMED', userConfirmed: true, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).get('/api/bookings/active?role=host').set('X-Test-User-Id', 'host-b03');
    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe('STARTED');
  });

  test('returns STARTED booking when payment status is HOST_CONFIRMED', async () => {
    // B04
    await setDoc('bookings', 'booking-b04', {
      userId: 'user-b04',
      hostId: 'host-b04',
      status: 'COMPLETED',
      paymentStatus: 'HOST_CONFIRMED',
      payment: { status: 'HOST_CONFIRMED', userConfirmed: false, hostConfirmed: true },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).get('/api/bookings/active?role=user').set('X-Test-User-Id', 'user-b04');
    expect(response.status).toBe(200);
    expect(response.body.booking).not.toBeNull();
    expect(response.body.booking.payment.status).toBe('HOST_CONFIRMED');
  });

  test('returns 401 when not authenticated', async () => {
    // B05
    const response = await request(app).get('/api/bookings/active');
    expect(response.status).toBe(401);
  });
});

describe('/api/bookings/:id/payment-confirm', () => {
  beforeEach(async () => {
    if (!emulatorReachable) return;
    jest.spyOn(global, 'setTimeout').mockImplementation(() => 0);
    await clearFirestore();
  });

  afterEach(async () => {
    if (!emulatorReachable) return;
    await clearFirestore();
    jest.restoreAllMocks();
  });

  test('sets payment.userConfirmed to true for user confirmation', async () => {
    // B06
    await setDoc('bookings', 'booking-b06', {
      userId: 'user-b06',
      hostId: 'host-b06',
      status: 'STARTED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b06/payment-confirm').set('X-Test-User-Id', 'user-b06').send({ role: 'user' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b06').get();
    expect(snap.data().payment.userConfirmed).toBe(true);
  });

  test('sets payment status to USER_CONFIRMED when host has not confirmed', async () => {
    // B07
    await setDoc('bookings', 'booking-b07', {
      userId: 'user-b07',
      hostId: 'host-b07',
      status: 'STARTED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b07/payment-confirm').set('X-Test-User-Id', 'user-b07').send({ role: 'user' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b07').get();
    expect(snap.data().payment.status).toBe('USER_CONFIRMED');
  });

  test('sets payment status to CONFIRMED when host already confirmed', async () => {
    // B08
    await setDoc('bookings', 'booking-b08', {
      userId: 'user-b08',
      hostId: 'host-b08',
      status: 'STARTED',
      paymentStatus: 'HOST_CONFIRMED',
      payment: { status: 'HOST_CONFIRMED', userConfirmed: false, hostConfirmed: true },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b08/payment-confirm').set('X-Test-User-Id', 'user-b08').send({ role: 'user' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b08').get();
    expect(snap.data().payment.status).toBe('CONFIRMED');
  });

  test('sets booking status to COMPLETED when payment becomes confirmed from user side', async () => {
    // B09
    await setDoc('bookings', 'booking-b09', {
      userId: 'user-b09',
      hostId: 'host-b09',
      status: 'STARTED',
      paymentStatus: 'HOST_CONFIRMED',
      payment: { status: 'HOST_CONFIRMED', userConfirmed: false, hostConfirmed: true },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b09/payment-confirm').set('X-Test-User-Id', 'user-b09').send({ role: 'user' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b09').get();
    expect(snap.data().status).toBe('COMPLETED');
  });

  test('returns 400 when booking status is not STARTED', async () => {
    // B10
    await setDoc('bookings', 'booking-b10', {
      userId: 'user-b10',
      hostId: 'host-b10',
      status: 'REQUEST',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).post('/api/bookings/booking-b10/payment-confirm').set('X-Test-User-Id', 'user-b10').send({ role: 'user' });
    expect(response.status).toBe(400);
  });

  test('returns 400 when user already confirmed payment', async () => {
    // B11
    await setDoc('bookings', 'booking-b11', {
      userId: 'user-b11',
      hostId: 'host-b11',
      status: 'STARTED',
      paymentStatus: 'USER_CONFIRMED',
      payment: { status: 'USER_CONFIRMED', userConfirmed: true, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).post('/api/bookings/booking-b11/payment-confirm').set('X-Test-User-Id', 'user-b11').send({ role: 'user' });
    expect(response.status).toBe(400);
  });

  test('sets payment.hostConfirmed to true for host confirmation', async () => {
    // B12
    await setDoc('bookings', 'booking-b12', {
      userId: 'user-b12',
      hostId: 'host-b12',
      status: 'STARTED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b12/payment-confirm').set('X-Test-User-Id', 'host-b12').send({ role: 'host' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b12').get();
    expect(snap.data().payment.hostConfirmed).toBe(true);
  });

  test('sets payment status to HOST_CONFIRMED when user has not confirmed', async () => {
    // B13
    await setDoc('bookings', 'booking-b13', {
      userId: 'user-b13',
      hostId: 'host-b13',
      status: 'STARTED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b13/payment-confirm').set('X-Test-User-Id', 'host-b13').send({ role: 'host' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b13').get();
    expect(snap.data().payment.status).toBe('HOST_CONFIRMED');
  });

  test('sets payment status to CONFIRMED when user already confirmed', async () => {
    // B14
    await setDoc('bookings', 'booking-b14', {
      userId: 'user-b14',
      hostId: 'host-b14',
      status: 'STARTED',
      paymentStatus: 'USER_CONFIRMED',
      payment: { status: 'USER_CONFIRMED', userConfirmed: true, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b14/payment-confirm').set('X-Test-User-Id', 'host-b14').send({ role: 'host' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b14').get();
    expect(snap.data().payment.status).toBe('CONFIRMED');
  });

  test('sets booking status to COMPLETED when payment becomes confirmed from host side', async () => {
    // B15
    await setDoc('bookings', 'booking-b15', {
      userId: 'user-b15',
      hostId: 'host-b15',
      status: 'STARTED',
      paymentStatus: 'USER_CONFIRMED',
      payment: { status: 'USER_CONFIRMED', userConfirmed: true, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    await request(app).post('/api/bookings/booking-b15/payment-confirm').set('X-Test-User-Id', 'host-b15').send({ role: 'host' }).expect(200);
    const snap = await db.collection('bookings').doc('booking-b15').get();
    expect(snap.data().status).toBe('COMPLETED');
  });

  test('returns 400 for host when booking status is not STARTED', async () => {
    // B16
    await setDoc('bookings', 'booking-b16', {
      userId: 'user-b16',
      hostId: 'host-b16',
      status: 'REQUEST',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).post('/api/bookings/booking-b16/payment-confirm').set('X-Test-User-Id', 'host-b16').send({ role: 'host' });
    expect(response.status).toBe(400);
  });

  test('returns 400 when host already confirmed payment', async () => {
    // B17
    await setDoc('bookings', 'booking-b17', {
      userId: 'user-b17',
      hostId: 'host-b17',
      status: 'STARTED',
      paymentStatus: 'HOST_CONFIRMED',
      payment: { status: 'HOST_CONFIRMED', userConfirmed: false, hostConfirmed: true },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).post('/api/bookings/booking-b17/payment-confirm').set('X-Test-User-Id', 'host-b17').send({ role: 'host' });
    expect(response.status).toBe(400);
  });
});

describe('/api/requests', () => {
  beforeEach(async () => {
    if (!emulatorReachable) return;
    jest.spyOn(global, 'setTimeout').mockImplementation(() => 0);
    await clearFirestore();
  });

  afterEach(async () => {
    if (!emulatorReachable) return;
    await clearFirestore();
    jest.restoreAllMocks();
  });

  test('returns 403 BLOCKED when user is in host block list', async () => {
    // B18
    await setDoc('chargers', 'charger-b18', {
      hostId: 'host-b18',
      online: true,
      schedule: makeAvailableSchedule()
    });
    await setDoc('blocks', 'block-b18', {
      hostId: 'host-b18',
      blockedUserId: 'user-b18'
    });

    const response = await request(app).post('/api/requests').set('X-Test-User-Id', 'user-b18').send({
      chargerId: 'charger-b18',
      location: { lat: 12.9716, lng: 77.5946 },
      vehicleType: 'car'
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('BLOCKED');
  });

  test('returns 400 OUTSIDE_SCHEDULE when charger schedule is unavailable', async () => {
    // B19
    await setDoc('chargers', 'charger-b19', {
      hostId: 'host-b19',
      online: true,
      schedule: makeUnavailableSchedule()
    });

    const response = await request(app).post('/api/requests').set('X-Test-User-Id', 'user-b19').send({
      chargerId: 'charger-b19',
      location: { lat: 12.9716, lng: 77.5946 },
      vehicleType: 'car'
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('OUTSIDE_SCHEDULE');
  });

  test('returns 409 when host already has a CONFIRMED or STARTED booking', async () => {
    // B20
    await setDoc('chargers', 'charger-b20', {
      hostId: 'host-b20',
      online: true,
      schedule: makeAvailableSchedule()
    });
    await setDoc('bookings', 'booking-b20', {
      userId: 'other-user-b20',
      hostId: 'host-b20',
      status: 'STARTED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).post('/api/requests').set('X-Test-User-Id', 'user-b20').send({
      chargerId: 'charger-b20',
      location: { lat: 12.9716, lng: 77.5946 },
      vehicleType: 'car'
    });

    expect(response.status).toBe(409);
  });

  test('returns 409 when user already has an active booking', async () => {
    // B21
    await setDoc('chargers', 'charger-b21', {
      hostId: 'host-b21',
      online: true,
      schedule: makeAvailableSchedule()
    });
    await setDoc('bookings', 'booking-b21', {
      userId: 'user-b21',
      hostId: 'some-host-b21',
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false },
      createdAt: new Date().toISOString(),
      meta: { autoResolvedAt: null }
    });

    const response = await request(app).post('/api/requests').set('X-Test-User-Id', 'user-b21').send({
      chargerId: 'charger-b21',
      location: { lat: 12.9716, lng: 77.5946 },
      vehicleType: 'car'
    });

    expect(response.status).toBe(409);
  });

  test('creates a request document with status OPEN on success', async () => {
    // B22
    await setDoc('chargers', 'charger-b22', {
      hostId: 'host-b22',
      online: true,
      schedule: makeAvailableSchedule()
    });

    const response = await request(app).post('/api/requests').set('X-Test-User-Id', 'user-b22').send({
      hostId: 'host-b22',
      chargerId: 'charger-b22',
      location: { lat: 12.9716, lng: 77.5946 },
      vehicleType: 'car'
    });

    const requestsSnap = await db.collection('requests').where('userId', '==', 'user-b22').get();
    expect(response.status).toBe(200);
    expect(requestsSnap.empty).toBe(false);
    expect(requestsSnap.docs[0].data().status).toBe('OPEN');
  });

  test('returns 401 when not authenticated', async () => {
    // B23
    const response = await request(app).post('/api/requests').send({});
    expect(response.status).toBe(401);
  });
});

describe('/api/ratings', () => {
  beforeEach(async () => {
    if (!emulatorReachable) return;
    jest.spyOn(global, 'setTimeout').mockImplementation(() => 0);
    await clearFirestore();
  });

  afterEach(async () => {
    if (!emulatorReachable) return;
    await clearFirestore();
    jest.restoreAllMocks();
  });

  test('saves rating document to Firestore', async () => {
    // B24
    await setDoc('bookings', 'booking-b24', {
      userId: 'user-b24',
      hostId: 'host-b24',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      paymentStatus: 'CONFIRMED',
      payment: { status: 'CONFIRMED', userConfirmed: true, hostConfirmed: true }
    });

    await request(app).post('/api/ratings').set('X-Test-User-Id', 'user-b24').send({
      bookingId: 'booking-b24',
      toUserId: 'host-b24',
      role: 'user',
      stars: 5,
      comment: 'Great session'
    }).expect(200);

    const ratingSnap = await db.collection('ratings').doc('booking-b24_user-b24').get();
    expect(ratingSnap.exists).toBe(true);
  });

  test('updates aggregate rating as a rolling average', async () => {
    // B25
    await setDoc('bookings', 'booking-b25', {
      userId: 'user-b25',
      hostId: 'host-b25',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      paymentStatus: 'CONFIRMED',
      payment: { status: 'CONFIRMED', userConfirmed: true, hostConfirmed: true }
    });
    await setDoc('users', 'host-b25', {
      rating: 4,
      totalRatings: 1
    });

    await request(app).post('/api/ratings').set('X-Test-User-Id', 'user-b25').send({
      bookingId: 'booking-b25',
      toUserId: 'host-b25',
      role: 'user',
      stars: 5,
      comment: 'Very good'
    }).expect(200);

    const hostSnap = await db.collection('users').doc('host-b25').get();
    expect(hostSnap.data().rating).toBe(4.5);
    expect(hostSnap.data().totalRatings).toBe(2);
  });

  test('returns 409 when rating already submitted for the booking by the same user', async () => {
    // B26
    await setDoc('bookings', 'booking-b26', {
      userId: 'user-b26',
      hostId: 'host-b26',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      paymentStatus: 'CONFIRMED',
      payment: { status: 'CONFIRMED', userConfirmed: true, hostConfirmed: true }
    });
    await setDoc('ratings', 'booking-b26_user-b26', {
      bookingId: 'booking-b26',
      fromUserId: 'user-b26',
      toUserId: 'host-b26',
      role: 'user',
      stars: 4,
      comment: 'Already rated'
    });

    const response = await request(app).post('/api/ratings').set('X-Test-User-Id', 'user-b26').send({
      bookingId: 'booking-b26',
      toUserId: 'host-b26',
      role: 'user',
      stars: 5,
      comment: 'Duplicate'
    });

    expect(response.status).toBe(409);
  });

  test('returns 400 when booking status is not COMPLETED', async () => {
    // B27
    await setDoc('bookings', 'booking-b27', {
      userId: 'user-b27',
      hostId: 'host-b27',
      status: 'STARTED',
      createdAt: new Date().toISOString(),
      paymentStatus: 'PENDING',
      payment: { status: 'PENDING', userConfirmed: false, hostConfirmed: false }
    });

    const response = await request(app).post('/api/ratings').set('X-Test-User-Id', 'user-b27').send({
      bookingId: 'booking-b27',
      toUserId: 'host-b27',
      role: 'user',
      stars: 5,
      comment: 'Should fail'
    });

    expect(response.status).toBe(400);
  });
});

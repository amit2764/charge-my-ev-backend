process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ev-p2p-test';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

const net = require('net');

jest.mock('../../utils/notify', () => ({
  sendPushNotification: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../stopOrphanedSessions', () => ({
  stopOrphanedSessions: jest.fn().mockResolvedValue(0)
}));

const { db } = require('../../lib/firestore');
const { resolveStuckPayments } = require('../resolveStuckPayments');

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

async function clearBookings() {
  const refs = await db.collection('bookings').listDocuments();
  await Promise.all(refs.map((ref) => ref.delete().catch(() => {})));
}

function minutesAgo(minutes) {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

function hoursAgo(hours) {
  return new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
}

async function seedBooking(id, overrides) {
  const payload = {
    id,
    userId: `${id}-user`,
    hostId: `${id}-host`,
    status: 'STARTED',
    paymentStatus: 'PENDING',
    payment: {
      status: 'PENDING',
      userConfirmed: false,
      hostConfirmed: false
    },
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(6),
    meta: {
      autoResolvedAt: null,
      autoResolution: null
    },
    ...overrides
  };

  await db.collection('bookings').doc(id).set(payload);
  return payload;
}

describe('resolveStuckPayments', () => {
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

  beforeEach(async () => {
    if (!emulatorReachable) return;
    await clearBookings();
  });

  afterEach(async () => {
    if (!emulatorReachable) return;
    await clearBookings();
    jest.clearAllMocks();
  });

  test('auto-confirms when only the user confirmed and session ended over 30 minutes ago', async () => {
    // C01
    await seedBooking('booking-c01', {
      paymentStatus: 'USER_CONFIRMED',
      payment: {
        status: 'USER_CONFIRMED',
        userConfirmed: true,
        hostConfirmed: false
      },
      endTime: minutesAgo(31),
      updatedAt: minutesAgo(31)
    });

    await resolveStuckPayments();

    const snap = await db.collection('bookings').doc('booking-c01').get();
    expect(snap.data().payment.status).toBe('CONFIRMED');
    expect(snap.data().status).toBe('COMPLETED');
    expect(snap.data().meta.autoResolution).toBe('auto_host_absent');
  });

  test('moves to support when only the host confirmed and session ended over 30 minutes ago', async () => {
    // C02
    await seedBooking('booking-c02', {
      paymentStatus: 'HOST_CONFIRMED',
      payment: {
        status: 'HOST_CONFIRMED',
        userConfirmed: false,
        hostConfirmed: true
      },
      endTime: minutesAgo(31),
      updatedAt: minutesAgo(31)
    });

    await resolveStuckPayments();

    const snap = await db.collection('bookings').doc('booking-c02').get();
    expect(snap.data().payment.status).toBe('REQUIRES_SUPPORT');
    expect(snap.data().meta.autoResolution).toBe('auto_user_absent');
  });

  test('expires payment when neither side confirmed and session ended over 30 minutes ago', async () => {
    // C03
    await seedBooking('booking-c03', {
      paymentStatus: 'PENDING',
      payment: {
        status: 'PENDING',
        userConfirmed: false,
        hostConfirmed: false
      },
      endTime: minutesAgo(31),
      updatedAt: minutesAgo(31)
    });

    await resolveStuckPayments();

    const snap = await db.collection('bookings').doc('booking-c03').get();
    expect(snap.data().payment.status).toBe('EXPIRED');
    expect(snap.data().meta.autoResolution).toBe('auto_both_absent');
  });

  test('marks orphaned sessions for support after five hours', async () => {
    // C04
    await seedBooking('booking-c04', {
      paymentStatus: 'PENDING',
      payment: {
        status: 'PENDING',
        userConfirmed: false,
        hostConfirmed: false
      },
      startTime: hoursAgo(5),
      updatedAt: hoursAgo(5)
    });

    await resolveStuckPayments();

    const snap = await db.collection('bookings').doc('booking-c04').get();
    expect(snap.data().payment.status).toBe('REQUIRES_SUPPORT');
    expect(snap.data().meta.autoResolution).toBe('orphaned_session');
  });

  test('does not modify a booking that already has autoResolvedAt', async () => {
    // C05
    const original = await seedBooking('booking-c05', {
      paymentStatus: 'PENDING',
      payment: {
        status: 'PENDING',
        userConfirmed: false,
        hostConfirmed: false
      },
      endTime: hoursAgo(2),
      updatedAt: hoursAgo(2),
      meta: {
        autoResolvedAt: new Date().toISOString(),
        autoResolution: 'already_processed'
      }
    });

    await resolveStuckPayments();

    const snap = await db.collection('bookings').doc('booking-c05').get();
    expect(snap.exists).toBe(true);
    const next = snap.data();
    expect(next.status).toBe(original.status);
    expect(next.payment.status).toBe(original.payment.status);
    expect(next.paymentStatus).toBe(original.paymentStatus);
    expect(next.meta.autoResolution).toBe('already_processed');
    expect(next.meta.autoResolvedAt).toBe(original.meta.autoResolvedAt);
  });

  test('does not modify a booking under the 30 minute threshold', async () => {
    // C06
    const original = await seedBooking('booking-c06', {
      paymentStatus: 'PENDING',
      payment: {
        status: 'PENDING',
        userConfirmed: false,
        hostConfirmed: false
      },
      endTime: minutesAgo(20),
      updatedAt: minutesAgo(20)
    });

    await resolveStuckPayments();

    const snap = await db.collection('bookings').doc('booking-c06').get();
    expect(snap.exists).toBe(true);
    const next = snap.data();
    expect(next.status).toBe(original.status);
    expect(next.payment.status).toBe(original.payment.status);
    expect(next.payment.userConfirmed).toBe(false);
    expect(next.payment.hostConfirmed).toBe(false);
    expect(next.paymentStatus).toBe('PENDING');
    expect(next.meta.autoResolvedAt).toBeNull();
    expect(next.meta.autoResolution).toBeNull();
  });
});

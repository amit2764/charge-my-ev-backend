const fs = require('fs');
const path = require('path');
const vm = require('vm');

function buildBooking({
  status = 'STARTED',
  paymentStatus = 'PENDING',
  userConfirmed = false,
  hostConfirmed = false,
  userId = 'user-1',
  hostId = 'host-1',
  endTime = null
} = {}) {
  return {
    id: 'booking-1',
    requestId: 'request-1',
    userId,
    hostId,
    status,
    paymentStatus,
    payment: {
      status: paymentStatus,
      userConfirmed,
      hostConfirmed
    },
    endTime
  };
}

let cachedResolver = null;

function loadResolverFromSource() {
  if (cachedResolver) {
    return cachedResolver;
  }

  const filePath = path.resolve(__dirname, '../../../ev-frontend/src/resolveBookingState.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const transformedSource = source
    .replace(/import\s+\*\s+as\s+Sentry\s+from\s+['\"]@sentry\/react['\"];?\s*/g, '')
    .replace('export function resolveBookingState', 'function resolveBookingState');

  const wrappedSource = `
    const Sentry = { addBreadcrumb: () => {} };
    ${transformedSource}
    module.exports = { resolveBookingState };
  `;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(wrappedSource, sandbox, { filename: 'resolveBookingState.loader.js' });
  cachedResolver = sandbox.module.exports.resolveBookingState;
  return cachedResolver;
}

function resolve(booking, myUserId) {
  return loadResolverFromSource()(booking, myUserId);
}

describe('resolveBookingState', () => {
  afterEach(() => {
    cachedResolver = null;
    jest.restoreAllMocks();
  });

  test('returns HOME for a null booking', () => {
    // T01
    const result = resolve(null, 'user-1');
    expect(result.screen).toBe('HOME');
    expect(result.subState).toBeNull();
  });

  test('returns RATING for COMPLETED as user', () => {
    // T02
    const result = resolve(buildBooking({ status: 'COMPLETED', paymentStatus: 'CONFIRMED', userConfirmed: true, hostConfirmed: true }), 'user-1');
    expect(result.screen).toBe('RATING');
    expect(result.subState).toBeNull();
  });

  test('returns RATING for COMPLETED as host', () => {
    // T03
    const result = resolve(buildBooking({ status: 'COMPLETED', paymentStatus: 'CONFIRMED', userConfirmed: true, hostConfirmed: true }), 'host-1');
    expect(result.screen).toBe('RATING');
    expect(result.subState).toBeNull();
  });

  test('returns RATING for STARTED with CONFIRMED payment as user', () => {
    // T04
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'CONFIRMED', userConfirmed: true, hostConfirmed: true, endTime: new Date().toISOString() }), 'user-1');
    expect(result.screen).toBe('RATING');
    expect(result.subState).toBeNull();
  });

  test('returns RATING for STARTED with CONFIRMED payment as host', () => {
    // T05
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'CONFIRMED', userConfirmed: true, hostConfirmed: true, endTime: new Date().toISOString() }), 'host-1');
    expect(result.screen).toBe('RATING');
    expect(result.subState).toBeNull();
  });

  test('returns PAYMENT_EXPIRED for STARTED with EXPIRED payment as user', () => {
    // T06
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'EXPIRED', endTime: new Date().toISOString() }), 'user-1');
    expect(result.screen).toBe('PAYMENT_EXPIRED');
    expect(result.subState).toBeNull();
  });

  test('returns PAYMENT_EXPIRED for STARTED with EXPIRED payment as host', () => {
    // T07
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'EXPIRED', endTime: new Date().toISOString() }), 'host-1');
    expect(result.screen).toBe('PAYMENT_EXPIRED');
    expect(result.subState).toBeNull();
  });

  test('returns SUPPORT for STARTED with REQUIRES_SUPPORT payment as user', () => {
    // T08
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'REQUIRES_SUPPORT', endTime: new Date().toISOString() }), 'user-1');
    expect(result.screen).toBe('SUPPORT');
    expect(result.subState).toBeNull();
  });

  test('returns SUPPORT for STARTED with REQUIRES_SUPPORT payment as host', () => {
    // T09
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'REQUIRES_SUPPORT', endTime: new Date().toISOString() }), 'host-1');
    expect(result.screen).toBe('SUPPORT');
    expect(result.subState).toBeNull();
  });

  test('returns PAYMENT USER_MUST_CONFIRM for pending payment as user', () => {
    // T10
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'PENDING', userConfirmed: false, hostConfirmed: false, endTime: new Date().toISOString() }), 'user-1');
    expect(result.screen).toBe('PAYMENT');
    expect(result.subState).toBe('USER_MUST_CONFIRM');
  });

  test('returns PAYMENT USER_MUST_CONFIRM for HOST_CONFIRMED payment as user', () => {
    // T11
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'HOST_CONFIRMED', userConfirmed: false, hostConfirmed: true, endTime: new Date().toISOString() }), 'user-1');
    expect(result.screen).toBe('PAYMENT');
    expect(result.subState).toBe('USER_MUST_CONFIRM');
  });

  test('returns PAYMENT WAITING_FOR_HOST for USER_CONFIRMED payment as user', () => {
    // T12
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'USER_CONFIRMED', userConfirmed: true, hostConfirmed: false, endTime: new Date().toISOString() }), 'user-1');
    expect(result.screen).toBe('PAYMENT');
    expect(result.subState).toBe('WAITING_FOR_HOST');
  });

  test('returns PAYMENT HOST_MUST_CONFIRM for pending payment as host', () => {
    // T13
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'PENDING', userConfirmed: false, hostConfirmed: false, endTime: new Date().toISOString() }), 'host-1');
    expect(result.screen).toBe('PAYMENT');
    expect(result.subState).toBe('HOST_MUST_CONFIRM');
  });

  test('returns PAYMENT HOST_MUST_CONFIRM for USER_CONFIRMED payment as host', () => {
    // T14
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'USER_CONFIRMED', userConfirmed: true, hostConfirmed: false, endTime: new Date().toISOString() }), 'host-1');
    expect(result.screen).toBe('PAYMENT');
    expect(result.subState).toBe('HOST_MUST_CONFIRM');
  });

  test('returns PAYMENT WAITING_FOR_USER for HOST_CONFIRMED payment as host', () => {
    // T15
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'HOST_CONFIRMED', userConfirmed: false, hostConfirmed: true, endTime: new Date().toISOString() }), 'host-1');
    expect(result.screen).toBe('PAYMENT');
    expect(result.subState).toBe('WAITING_FOR_USER');
  });

  test('returns CHARGING_RUN for live STARTED session as user', () => {
    // T16
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'PENDING', userConfirmed: false, hostConfirmed: false, endTime: null }), 'user-1');
    expect(result.screen).toBe('CHARGING_RUN');
    expect(result.subState).toBeNull();
  });

  test('returns CHARGING_RUN for live STARTED session as host', () => {
    // T16
    const result = resolve(buildBooking({ status: 'STARTED', paymentStatus: 'PENDING', userConfirmed: false, hostConfirmed: false, endTime: null }), 'host-1');
    expect(result.screen).toBe('CHARGING_RUN');
    expect(result.subState).toBeNull();
  });

  test('returns CHARGING_WAIT for CONFIRMED booking as user', () => {
    // T17
    const result = resolve(buildBooking({ status: 'CONFIRMED' }), 'user-1');
    expect(result.screen).toBe('CHARGING_WAIT');
    expect(result.subState).toBeNull();
  });

  test('returns CHARGING_WAIT for CONFIRMED booking as host', () => {
    // T17
    const result = resolve(buildBooking({ status: 'CONFIRMED' }), 'host-1');
    expect(result.screen).toBe('CHARGING_WAIT');
    expect(result.subState).toBeNull();
  });

  test('returns CONFIRM for BOOKED booking as user', () => {
    // T18
    const result = resolve(buildBooking({ status: 'BOOKED' }), 'user-1');
    expect(result.screen).toBe('CONFIRM');
    expect(result.subState).toBeNull();
  });

  test('returns CONFIRM for BOOKED booking as host', () => {
    // T18
    const result = resolve(buildBooking({ status: 'BOOKED' }), 'host-1');
    expect(result.screen).toBe('CONFIRM');
    expect(result.subState).toBeNull();
  });

  test('returns MATCHING for REQUEST booking as user', () => {
    // T19
    const result = resolve(buildBooking({ status: 'REQUEST' }), 'user-1');
    expect(result.screen).toBe('MATCHING');
    expect(result.subState).toBeNull();
  });

  test('returns MATCHING for REQUEST booking as host', () => {
    // T19
    const result = resolve(buildBooking({ status: 'REQUEST' }), 'host-1');
    expect(result.screen).toBe('MATCHING');
    expect(result.subState).toBeNull();
  });
});

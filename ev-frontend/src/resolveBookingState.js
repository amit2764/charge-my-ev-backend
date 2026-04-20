import * as Sentry from '@sentry/react';

function matchesValue(actual, expected) {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

function matchesRule(condition, context) {
  return Object.entries(condition).every(([key, expected]) => {
    const actual = context[key];
    return matchesValue(actual, expected);
  });
}

const DECISION_RULES = [
  {
    condition: {
      'booking.status': 'COMPLETED'
    },
    output: {
      screen: 'RATING',
      subState: null,
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': 'CONFIRMED',
      'booking.payment.userConfirmed': true,
      'booking.payment.hostConfirmed': true
    },
    output: {
      screen: 'RATING',
      subState: null,
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': 'EXPIRED'
    },
    output: {
      screen: 'PAYMENT_EXPIRED',
      subState: null,
      banner: 'Payment window expired. Contact support if needed.'
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': 'REQUIRES_SUPPORT'
    },
    output: {
      screen: 'SUPPORT',
      subState: null,
      banner: 'This session has been escalated to support.'
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': ['PENDING', 'HOST_CONFIRMED'],
      role: 'user',
      'booking.payment.userConfirmed': false
    },
    output: {
      screen: 'PAYMENT',
      subState: 'USER_MUST_CONFIRM',
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': ['USER_CONFIRMED'],
      role: 'user',
      'booking.payment.userConfirmed': true,
      'booking.payment.hostConfirmed': false
    },
    output: {
      screen: 'PAYMENT',
      subState: 'WAITING_FOR_HOST',
      banner: 'Waiting for host to confirm cash received'
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': ['PENDING', 'USER_CONFIRMED'],
      role: 'host',
      'booking.payment.hostConfirmed': false
    },
    output: {
      screen: 'PAYMENT',
      subState: 'HOST_MUST_CONFIRM',
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': ['HOST_CONFIRMED'],
      role: 'host',
      'booking.payment.hostConfirmed': true,
      'booking.payment.userConfirmed': false
    },
    output: {
      screen: 'PAYMENT',
      subState: 'WAITING_FOR_USER',
      banner: 'Waiting for user to confirm payment sent'
    }
  },
  {
    condition: {
      'booking.status': 'STARTED',
      'booking.payment.status': 'PENDING',
      'booking.payment.userConfirmed': false,
      'booking.payment.hostConfirmed': false
    },
    output: {
      screen: 'CHARGING_RUN',
      subState: null,
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'CONFIRMED'
    },
    output: {
      screen: 'CHARGING_WAIT',
      subState: null,
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'BOOKED'
    },
    output: {
      screen: 'CONFIRM',
      subState: null,
      banner: null
    }
  },
  {
    condition: {
      'booking.status': 'REQUEST'
    },
    output: {
      screen: 'MATCHING',
      subState: null,
      banner: null
    }
  }
];

function addResolveBreadcrumb({ booking, role, status, paymentStatus, userConfirmed, hostConfirmed, screen }) {
  Sentry.addBreadcrumb({
    category: 'resolveBookingState',
    level: 'info',
    message: `resolveBookingState -> ${screen}`,
    data: {
      bookingId: booking?.id || null,
      role: role || null,
      bookingStatus: status || null,
      paymentStatus: paymentStatus || null,
      userConfirmed: !!userConfirmed,
      hostConfirmed: !!hostConfirmed,
      screen
    }
  });
}

// Source-of-truth booking router.
// Returns: { screen, role, subState, banner }
export function resolveBookingState(booking, myUserId) {
  if (!booking) {
    const result = { screen: 'HOME', role: null, subState: null, banner: null };
    addResolveBreadcrumb({
      booking,
      role: null,
      status: null,
      paymentStatus: null,
      userConfirmed: false,
      hostConfirmed: false,
      screen: result.screen
    });
    return result;
  }

  const role = booking.userId === myUserId ? 'user' : 'host';
  const status = booking.status;
  const paymentStatus = String(booking.payment?.status || booking.paymentStatus || 'PENDING').toUpperCase();
  const userConfirmed = !!booking.payment?.userConfirmed;
  const hostConfirmed = !!booking.payment?.hostConfirmed;
  const hasEndedSession = !!booking.endTime;
  const paymentNeedsResolution = ['PENDING', 'USER_CONFIRMED', 'HOST_CONFIRMED'].includes(paymentStatus);
  const effectiveStatus = status === 'COMPLETED' && paymentNeedsResolution ? 'STARTED' : status;
  const context = {
    'booking.status': effectiveStatus,
    'booking.payment.status': paymentStatus,
    'booking.payment.userConfirmed': userConfirmed,
    'booking.payment.hostConfirmed': hostConfirmed,
    role
  };

  if (effectiveStatus === 'STARTED' && !hasEndedSession && paymentStatus === 'PENDING' && !userConfirmed && !hostConfirmed) {
    const result = { screen: 'CHARGING_RUN', role, subState: null, banner: null };
    addResolveBreadcrumb({
      booking,
      role,
      status: effectiveStatus,
      paymentStatus,
      userConfirmed,
      hostConfirmed,
      screen: result.screen
    });
    return result;
  }

  for (const rule of DECISION_RULES) {
    if (matchesRule(rule.condition, context)) {
      const result = {
        ...rule.output,
        role
      };
      addResolveBreadcrumb({
        booking,
        role,
        status: effectiveStatus,
        paymentStatus,
        userConfirmed,
        hostConfirmed,
        screen: result.screen
      });
      return result;
    }
  }

  const fallbackResult = { screen: 'HOME', role, subState: null, banner: null };
  addResolveBreadcrumb({
    booking,
    role,
    status: effectiveStatus,
    paymentStatus,
    userConfirmed,
    hostConfirmed,
    screen: fallbackResult.screen
  });
  return fallbackResult;
}
import { Card, Button } from './components';
import { resolveBookingState } from './resolveBookingState';

function formatAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

export default function PaymentScreen({ booking, myUserId, confirmPayment, loading = false }) {
  if (!booking) return null;

  const { subState, banner } = resolveBookingState(booking, myUserId);

  const views = {
    USER_MUST_CONFIRM: {
      heading: 'Confirm payment sent',
      body: `Pay INR ${formatAmount(booking.finalAmount)} cash to host`,
      btn: 'I have paid',
      role: 'user'
    },
    WAITING_FOR_HOST: {
      heading: 'Payment sent',
      body: 'Waiting for host to confirm cash received...',
      btn: null,
      role: null
    },
    HOST_MUST_CONFIRM: {
      heading: 'Confirm cash received',
      body: `User paid INR ${formatAmount(booking.finalAmount)}. Confirm you received it.`,
      btn: 'Cash received',
      role: 'host'
    },
    WAITING_FOR_USER: {
      heading: 'Cash confirmed',
      body: 'Waiting for user to confirm payment...',
      btn: null,
      role: null
    }
  };

  const view = views[subState];
  if (!view) {
    return (
      <Card className="tesla-panel text-center">
        {banner && (
          <div className="mb-4 rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-2 text-xs text-amber-300">
            {banner}
          </div>
        )}
        <h2 className="mb-3 text-xl font-bold text-white">Payment status</h2>
        <p className="text-sm text-gray-300">Current status: {booking.paymentStatus || booking.payment?.status || 'PENDING'}</p>
      </Card>
    );
  }

  return (
    <Card className="tesla-panel text-center">
      {banner && (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-2 text-xs text-amber-300">
          {banner}
        </div>
      )}
      <h2 className="mb-3 text-xl font-bold text-white">{view.heading}</h2>
      <p className="mb-5 text-sm text-gray-300">{view.body}</p>
            {booking.promoCode && (
              <div className="mb-4 rounded-lg border border-emerald-600 bg-emerald-950/30 px-3 py-2">
                <p className="text-xs text-emerald-300">✓ Promo applied: {booking.promoCode}</p>
              </div>
            )}
      {view.btn && (
        <Button
          onClick={() => confirmPayment(booking.id, view.role)}
          disabled={loading}
        >
          {loading ? 'Processing...' : view.btn}
        </Button>
      )}
    </Card>
  );
}
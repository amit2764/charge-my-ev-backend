import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import api from '../api';
import { Button, Card } from '../components';
import ReportModal from '../components/ReportModal';
import useReport from '../hooks/useReport';
import DisputeScreen from './DisputeScreen';
import DisputeStatusBanner from '../components/DisputeStatusBanner';

function formatDate(dateIso) {
  const dt = new Date(dateIso || Date.now());
  if (!Number.isFinite(dt.getTime())) return '-';
  return dt.toLocaleString();
}

function ratingLabel(value) {
  if (value === null || value === undefined) return 'Skipped';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n}/5`;
}

export default function SessionDetailScreen({ item, onBack, role = 'user', myUserId }) {
  if (!item) return null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [dispute, setDispute] = useState(null);
  const { loading, submitReport, blockUser } = useReport();

  const bookingId = item.bookingId || item.id;
  const reportedUserId = role === 'host' ? item.userId : item.hostId;
  const canBlock = role === 'host' && !!item.userId;
  const otherPartyName = item.otherPartyName || 'user';

  const canReport = useMemo(() => {
    return !!myUserId && !!reportedUserId && !!bookingId;
  }, [myUserId, reportedUserId, bookingId]);

  const canRaiseDispute = useMemo(() => {
    const dateMs = new Date(item.date || item.endTime || item.startTime || Date.now()).getTime();
    if (!Number.isFinite(dateMs)) return false;
    return (Date.now() - dateMs) <= (7 * 24 * 60 * 60 * 1000);
  }, [item.date, item.endTime, item.startTime]);

  useEffect(() => {
    let cancelled = false;

    const loadDispute = async () => {
      if (!bookingId) return;
      try {
        const res = await api.get(`/api/disputes/booking/${encodeURIComponent(bookingId)}`);
        if (cancelled) return;
        setDispute(res.data?.dispute || null);
      } catch {
        if (!cancelled) setDispute(null);
      }
    };

    loadDispute();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const handleSubmitReport = async ({ reason, details }) => {
    if (!canReport) throw new Error('Missing report context');
    await submitReport({
      reportedBy: myUserId,
      reportedUserId,
      bookingId,
      reason,
      details
    });
  };

  const handleBlock = async () => {
    if (!canBlock || !myUserId) throw new Error('Missing block context');
    await blockUser({
      hostId: myUserId,
      blockedUserId: item.userId
    });
  };

  const mapLabel = item.chargerLocation
    ? `${item.chargerLocation.lat || '-'}, ${item.chargerLocation.lng || '-'}`
    : 'Not available';

  if (showDisputeForm) {
    return (
      <DisputeScreen
        item={item}
        myUserId={myUserId}
        onCancel={() => setShowDisputeForm(false)}
        onRaised={(nextDispute) => {
          setDispute(nextDispute || null);
          setShowDisputeForm(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Session inspector</p>
          <h2 className="text-xl font-black text-white">Session Detail</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-gray-200 hover:bg-white/10"
              aria-label="More actions"
            >
              •••
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-[14px] border border-white/10 bg-slate-900/95 p-1 shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  disabled={!canReport}
                >
                  Report
                </button>
                {canBlock && (
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-900/30"
                    onClick={async () => {
                      setMenuOpen(false);
                      await handleBlock();
                    }}
                  >
                    Block user
                  </button>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>
      </div>

      <DisputeStatusBanner dispute={dispute} />

      <Card>
        <h3 className="mb-3 text-base font-bold text-cyan-300">Full Breakdown</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>Date: <span className="text-white">{formatDate(item.date)}</span></p>
          <p>Other Party: <span className="text-white">{item.otherPartyName || 'Unknown'}</span></p>
          <p>Other Party Rating: <span className="text-yellow-300">{item.otherPartyRating ?? '-'}</span></p>
          <p>kWh: <span className="text-white">{Number(item.kwh || 0).toFixed(2)}</span></p>
          <p>Duration: <span className="text-white">{item.duration || 0} minutes</span></p>
          <p>Amount: <span className="premium-number text-emerald-300">${Number(item.finalAmount || 0).toFixed(2)}</span></p>
          <p>Payment Status: <span className="text-white">{item.paymentStatus || '-'}</span></p>
          <p>Payment Method: <span className="text-white">{item.paymentMethod || 'cash'}</span></p>
          <p>Rating Submitted: <span className="text-yellow-300">{ratingLabel(item.myRating)}</span></p>
          <p>Charger Pin: <span className="text-white">{mapLabel}</span></p>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-bold text-cyan-300">Receipt</h3>
        <p className="text-sm text-gray-400">Booking ID: <span className="text-gray-200">{item.bookingId || item.id}</span></p>
        <p className="text-sm text-gray-400">Start: <span className="text-gray-200">{formatDate(item.startTime)}</span></p>
        <p className="text-sm text-gray-400">End: <span className="text-gray-200">{formatDate(item.endTime)}</span></p>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-bold text-cyan-300">Chat Transcript</h3>
        <a
          href={item.chatLink}
          className="inline-block rounded-[14px] border border-cyan-500/35 bg-cyan-900/15 px-3 py-2 text-sm text-cyan-300 transition hover:bg-cyan-900/25"
        >
          Open related booking chat
        </a>
      </Card>

      {canRaiseDispute && !dispute && (
        <Button
          variant="danger"
          onClick={() => setShowDisputeForm(true)}
        >
          Raise dispute
        </Button>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleSubmitReport}
        loading={loading}
        otherPartyName={otherPartyName}
        canBlock={canBlock}
        onBlock={handleBlock}
      />
    </div>
  );
}

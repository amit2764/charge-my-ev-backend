import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useStore } from '../store';
import { resolveBookingState } from '../resolveBookingState';
import { Card, Button } from '../components';
import VerifiedBadge from '../components/VerifiedBadge';

function emptyStatus() {
  return {
    status: 'UNVERIFIED',
    documentType: null,
    frontUrl: '',
    backUrl: '',
    submittedAt: null,
    reviewedAt: null,
    rejectionReason: null
  };
}

export default function KYCScreen({ onBack, onStatusChange }) {
  const { user, activeBooking } = useStore();
  const [statusData, setStatusData] = useState(emptyStatus());
  const [documentType, setDocumentType] = useState('aadhaar');
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    resolveBookingState(activeBooking, user);
  }, [activeBooking, user]);

  const loadStatus = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/kyc/status?userId=${encodeURIComponent(user)}`);
      const next = res.data?.kyc || emptyStatus();
      setStatusData(next);
      if (next.documentType) {
        setDocumentType(next.documentType);
      }
      if (typeof onStatusChange === 'function') {
        onStatusChange(next);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load KYC status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [user]);

  const canSubmit = useMemo(() => {
    return statusData.status === 'UNVERIFIED' || statusData.status === 'REJECTED';
  }, [statusData.status]);

  const submit = async () => {
    if (!user) {
      setError('Please sign in again.');
      return;
    }

    if (!frontFile) {
      setError('Please upload the front image.');
      return;
    }

    if (documentType === 'aadhaar' && !backFile) {
      setError('Please upload the back image for Aadhaar.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('userId', user);
      formData.append('documentType', documentType);
      formData.append('front', frontFile);
      if (backFile) formData.append('back', backFile);

      const res = await api.post('/api/kyc/submit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const next = res.data?.kyc || emptyStatus();
      setStatusData(next);
      setFrontFile(null);
      setBackFile(null);
      if (typeof onStatusChange === 'function') {
        onStatusChange(next);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit documents');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">KYC center</p>
          <h3 className="text-xl font-black text-white">Identity Verification</h3>
        </div>
        <button onClick={onBack} className="glass-surface rounded-[16px] px-3 py-2 text-sm font-semibold text-cyan-300">Back</button>
      </div>

      <Card>
        {statusData.status === 'VERIFIED' ? (
          <div className="flex items-center gap-2">
            <VerifiedBadge />
            <p className="text-sm text-emerald-300">Your identity has been verified.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-300">Current status: <span className="font-semibold text-white">{statusData.status}</span></p>
        )}

        {statusData.status === 'PENDING' && (
          <p className="mt-2 text-sm text-amber-300">Your documents are under manual review. Re-submission is disabled until review is complete.</p>
        )}

        {statusData.status === 'REJECTED' && statusData.rejectionReason && (
          <p className="mt-2 rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            Rejected: {statusData.rejectionReason}
          </p>
        )}

        {loading && <p className="mt-3 text-sm text-gray-400">Loading KYC status...</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </Card>

      <Card className="overflow-hidden">
        <h4 className="mb-3 text-base font-bold text-cyan-300">Submit documents</h4>

        <label className="mb-2 block text-sm text-gray-300">Document type</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={!canSubmit || submitting}
          className="mb-4 w-full rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
        >
          <option value="aadhaar">Aadhaar</option>
          <option value="driving_licence">Driving licence</option>
        </select>

        <label className="mb-1 block text-sm text-gray-300">Front image</label>
        <input
          type="file"
          accept="image/*"
          disabled={!canSubmit || submitting}
          onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
          className="mb-4 w-full rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
        />

        <label className="mb-1 block text-sm text-gray-300">Back image {documentType === 'aadhaar' ? '(required)' : '(optional)'}</label>
        <input
          type="file"
          accept="image/*"
          disabled={!canSubmit || submitting}
          onChange={(e) => setBackFile(e.target.files?.[0] || null)}
          className="mb-4 w-full rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
        />

        <Button onClick={submit} disabled={!canSubmit || submitting || loading}>
          {submitting ? 'Submitting...' : 'Submit for verification'}
        </Button>
      </Card>
    </div>
  );
}

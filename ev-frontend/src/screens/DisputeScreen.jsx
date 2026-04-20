import { useMemo, useState } from 'react';
import api from '../api';
import { Button, Card, Input, Select } from '../components';

const DISPUTE_REASONS = [
  'User paid but host did not confirm',
  'Host confirmed received but user disputes',
  'Auto-resolved as host absent',
  'Auto-resolved as user absent',
  'Other'
];

function toMillis(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export default function DisputeScreen({ item, myUserId, onCancel, onRaised }) {
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bookingId = item?.bookingId || item?.id || '';

  const canRaise = useMemo(() => {
    const completionMs = toMillis(item?.date) || toMillis(item?.endTime) || toMillis(item?.startTime);
    if (!completionMs) return false;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - completionMs) <= sevenDaysMs;
  }, [item]);

  const handleSelectEvidence = async (event) => {
    const file = event.target.files?.[0] || null;
    setEvidenceFile(file);
    if (!file) {
      setEvidencePreview('');
      return;
    }

    try {
      const preview = await fileToDataUrl(file);
      setEvidencePreview(preview);
    } catch {
      setEvidencePreview('');
      setError('Could not read selected image');
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!canRaise) {
      setError('Dispute can only be raised within 7 days of session completion');
      return;
    }
    if (!bookingId || !myUserId) {
      setError('Missing booking context');
      return;
    }
    if (!description.trim()) {
      setError('Please add a description');
      return;
    }

    setLoading(true);
    try {
      let evidenceUrl = '';
      if (evidenceFile) {
        evidenceUrl = await fileToDataUrl(evidenceFile);
      }

      const response = await api.post('/api/disputes', {
        bookingId,
        raisedBy: myUserId,
        reason,
        description: description.trim(),
        evidenceUrl
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to raise dispute');
      }

      if (typeof onRaised === 'function') {
        await onRaised(response.data?.dispute || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to raise dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Support center</p>
          <h2 className="text-xl font-black text-white">Raise Dispute</h2>
        </div>
        <Button variant="outline" onClick={onCancel}>Back</Button>
      </div>

      <Card>
        <p className="mb-3 text-sm text-gray-300">
          Use this form for payment disagreements. Disputes can be raised only within 7 days after session completion.
        </p>

        {!canRaise && (
          <p className="mb-3 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            This session is outside the 7-day dispute window.
          </p>
        )}

        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={DISPUTE_REASONS}
        />

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened"
        />

        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold text-gray-600">Photo Evidence (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleSelectEvidence}
            className="w-full rounded-[16px] border border-white/10 bg-slate-950/70 p-2 text-sm text-gray-200"
          />
          {evidencePreview && (
            <img
              src={evidencePreview}
              alt="Evidence preview"
              className="mt-3 max-h-52 rounded-lg border border-gray-700 object-contain"
            />
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !canRaise}>
            {loading ? 'Submitting...' : 'Raise Dispute'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

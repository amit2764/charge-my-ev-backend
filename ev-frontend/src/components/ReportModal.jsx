import { useMemo, useState } from 'react';
import { Button, Card, Input } from '../components';

const REPORT_REASONS = ['Fraud', 'No-show', 'Abusive behaviour', 'Incorrect listing', 'Other'];

export default function ReportModal({
  open,
  onClose,
  onSubmit,
  loading,
  otherPartyName = 'this user',
  canBlock = false,
  onBlock
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const detailsRequired = reason === 'Other';
  const detailsHint = useMemo(() => {
    if (detailsRequired) return 'Details are required for Other';
    return 'Optional details';
  }, [detailsRequired]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError('');
    if (detailsRequired && !details.trim()) {
      setError('Please provide details for Other');
      return;
    }
    try {
      await onSubmit({ reason, details: details.trim() });
      setDetails('');
      setReason(REPORT_REASONS[0]);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit report');
    }
  };

  const handleBlock = async () => {
    if (!onBlock) return;
    setError('');
    try {
      await onBlock();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to block user');
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/70 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:items-center">
      <Card className="w-full max-w-lg border border-red-500/35 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))]">
        <h3 className="mb-1 text-lg font-bold text-white">Report {otherPartyName}</h3>
        <p className="mb-4 text-sm text-gray-400">This action is private. The reported party will not be notified.</p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-300">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-[14px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <Input
            label={detailsHint}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={detailsRequired ? 'Please describe what happened' : 'Add context (optional)'}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Submitting...' : 'Submit Report'}</Button>
            {canBlock && (
              <Button variant="danger" onClick={handleBlock} disabled={loading}>
                {loading ? 'Blocking...' : 'Block User'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { resolveBookingState } from '../resolveBookingState';
import { Button, Card } from '../components';
import StarPicker from '../components/StarPicker';
import useRating from '../hooks/useRating';

export default function RatingScreen({ booking, myUserId, role, onDone }) {
  const toUserId = role === 'user' ? booking?.hostId : booking?.userId;
  const { alreadyRated, submitting, done, submitRating } = useRating(booking?.id, myUserId);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  // Mount guard: verify this screen should be visible
  useEffect(() => {
    if (!booking) {
      onDone?.();
      return;
    }
    const resolved = resolveBookingState(booking, myUserId);
    if (resolved.screen !== 'RATING') {
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run on mount only

  const handleSubmit = async () => {
    setError('');
    try {
      await submitRating({ toUserId, role, stars, comment });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to submit rating. Please try again.');
    }
  };

  const handleSkip = async () => {
    setError('');
    try {
      await submitRating({ toUserId, role, stars: null, comment: '' });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save skip state. Please try again.');
    }
  };

  // Loading state while checking if already rated
  if (alreadyRated === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[linear-gradient(180deg,#020617,#0f172a)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Already rated or just submitted → thank you state
  if (alreadyRated || done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[linear-gradient(180deg,#020617,#0f172a)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <Card className="w-full max-w-sm text-center">
          <p className="text-4xl mb-4">🎉</p>
          <h2 className="text-xl font-bold text-white mb-2">Thanks for your feedback!</h2>
          <p className="text-gray-400 mb-6 text-sm">Your rating helps build a trustworthy community.</p>
          <Button onClick={onDone}>Back to Home</Button>
        </Card>
      </div>
    );
  }

  const targetLabel = role === 'user' ? 'your host' : 'your user';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[linear-gradient(180deg,#020617,#0f172a)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
      <Card className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-white text-center mb-1">Rate {targetLabel}</h2>
        <p className="text-gray-400 text-sm text-center mb-6">How was your experience?</p>

        <StarPicker value={stars} onChange={setStars} disabled={submitting} />

        <textarea
          className="mt-6 w-full resize-none rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          placeholder="Leave a comment (optional)..."
          rows={3}
          maxLength={200}
          value={comment}
          onChange={(e) => setComment((e.target.value || '').slice(0, 200))}
          disabled={submitting}
        />
        <p className="text-xs text-gray-600 text-right mt-1">{comment.length}/200</p>

        {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}

        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="text-gray-500 text-sm py-2 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </Card>
    </div>
  );
}

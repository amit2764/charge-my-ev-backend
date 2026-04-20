import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Button, Card } from '../components';
import useSessionHistory from '../hooks/useSessionHistory';
import SessionHistoryRow from '../components/SessionHistoryRow';
import SessionDetailScreen from './SessionDetailScreen';

export default function SessionHistoryScreen({ role = 'user' }) {
  const { user } = useStore();
  const [selectedItem, setSelectedItem] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(null);
  const threshold = 70;

  const {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    range,
    setRange,
    refresh,
    loadMore
  } = useSessionHistory({ userId: user, role, pageSize: 20 });

  const handleTouchStart = (event) => {
    if (window.scrollY > 0 || refreshing || loading) return;
    touchStartY.current = event.touches?.[0]?.clientY ?? null;
  };

  const handleTouchMove = (event) => {
    if (touchStartY.current === null || window.scrollY > 0) return;
    const currentY = event.touches?.[0]?.clientY ?? touchStartY.current;
    const delta = Math.max(0, currentY - touchStartY.current);
    setPullDistance(Math.min(100, delta));
  };

  const handleTouchEnd = () => {
    if (touchStartY.current !== null && pullDistance >= threshold && !refreshing && !loading) {
      void refresh();
    }
    touchStartY.current = null;
    setPullDistance(0);
  };

  if (selectedItem) {
    return (
      <SessionDetailScreen
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        role={role}
        myUserId={user}
      />
    );
  }

  return (
    <div
      className="space-y-4 p-4 sm:p-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || refreshing) && (
        <p className="text-center text-xs text-cyan-300">
          {refreshing ? 'Refreshing...' : (pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh')}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">History explorer</p>
          <h2 className="text-xl font-black text-white">Session History</h2>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing || loading}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRange('7')}
            className={`rounded-[14px] px-2 py-2 text-xs font-bold transition ${range === '7' ? 'bg-blue-500/22 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setRange('30')}
            className={`rounded-[14px] px-2 py-2 text-xs font-bold transition ${range === '30' ? 'bg-blue-500/22 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => setRange('all')}
            className={`rounded-[14px] px-2 py-2 text-xs font-bold transition ${range === 'all' ? 'bg-blue-500/22 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            All Time
          </button>
        </div>
      </Card>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && (
        <Card className="skeleton-shimmer py-8 text-center text-gray-500">Loading history...</Card>
      )}

      {!loading && items.length === 0 && (
        <Card className="text-center py-10 text-gray-500">No completed sessions yet.</Card>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <SessionHistoryRow
            key={item.id}
            item={item}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {!loading && hasMore && (
        <div className="pt-2">
          <Button onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

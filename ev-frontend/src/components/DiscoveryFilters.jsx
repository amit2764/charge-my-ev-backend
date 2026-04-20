import { useState } from 'react';

export default function DiscoveryFilters({ filters, onApply, radiusKm, onRadiusChange, isListView, onToggleView }) {
  const [draft, setDraft] = useState(filters);

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(17,24,39,0.72))] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Discovery filters</p>
        <button
          onClick={onToggleView}
          className="min-h-[42px] rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-white/10"
        >
          {isListView ? 'Map view' : 'List view'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={draft.connectorType}
          onChange={(e) => setDraft((p) => ({ ...p, connectorType: e.target.value }))}
          placeholder="Connector"
          className="min-h-[44px] rounded-[14px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        />
        <input
          value={draft.minKw}
          onChange={(e) => setDraft((p) => ({ ...p, minKw: e.target.value.replace(/\D/g, '') }))}
          placeholder="Min kW"
          className="min-h-[44px] rounded-[14px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        />
        <input
          value={draft.maxPrice}
          onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value.replace(/[^\d.]/g, '') }))}
          placeholder="Max price"
          className="min-h-[44px] rounded-[14px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-400">Radius: {radiusKm} km</label>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="flex-1"
        />
        <button
          onClick={() => onApply(draft)}
          className="min-h-[42px] rounded-[14px] bg-cyan-500 px-3 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

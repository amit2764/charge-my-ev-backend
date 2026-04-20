import VerifiedBadge from './VerifiedBadge';

export default function HostBottomSheet({ host, onRequest, onClose }) {
  if (!host) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3">
      <div className="pointer-events-auto glass-surface overflow-hidden rounded-[30px] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.4)]">
        <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
          <div className="h-1.5 w-14 rounded-full bg-white/20" />
        </div>
        <div className="mb-4 flex items-start justify-between gap-3 pt-2">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-500/30 to-emerald-400/20 text-lg font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              {String(host.name || 'H').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{host.name || 'Host Charger'}</h3>
              {host.verified && <VerifiedBadge />}
              </div>
              <p className="mt-1 text-xs text-gray-400">{host.connectorType || 'Unknown connector'} • {host.powerKw || 0} kW</p>
              <p className="mt-1 text-xs text-cyan-300">Live peer charging near your route</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">Close</button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-gray-300">
          <div className="rounded-[18px] bg-white/5 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Rating</p>
            <p className="mt-1 text-sm font-bold text-white">★ {Number(host.rating || 0).toFixed(1)}</p>
          </div>
          <div className="rounded-[18px] bg-white/5 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Distance</p>
            <p className="mt-1 text-sm font-bold text-white">{Number(host.distance || 0).toFixed(2)} km</p>
          </div>
          <div className="rounded-[18px] bg-white/5 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Price</p>
            <p className="mt-1 text-sm font-bold text-cyan-300">₹{host.pricePerUnit ?? 0} / unit</p>
          </div>
          <div className="rounded-[18px] bg-white/5 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Status</p>
            <p className={host.available ? 'mt-1 text-sm font-bold text-emerald-300' : 'mt-1 text-sm font-bold text-gray-400'}>{host.available ? 'Available now' : `Next: ${host.nextAvailable || 'Unavailable'}`}</p>
          </div>
        </div>

        <button
          onClick={() => onRequest(host)}
          className="mt-4 w-full rounded-[20px] bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_40px_rgba(59,130,246,0.28)] hover:shadow-[0_22px_46px_rgba(59,130,246,0.34)]"
          disabled={!host.available}
        >
          Request charge
        </button>
      </div>
    </div>
  );
}

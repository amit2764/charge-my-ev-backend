export default function ChargerCard({ charger, onEdit, onToggle, onSchedule, toggling }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{charger.connectorType} • {charger.powerKw} kW</p>
          <p className="text-xs text-gray-400">{charger.pricingMode} • {charger.price}</p>
          <p className="mt-1 text-xs text-gray-500">{charger.address}</p>
        </div>
        <div className="text-right">
          <p className={`text-xs font-semibold ${charger.online ? 'text-green-400' : 'text-gray-500'}`}>
            {charger.online ? 'ONLINE' : 'OFFLINE'}
          </p>
          <p className="text-[11px] text-gray-500">Sessions: {charger.totalSessions || 0}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-md border border-gray-700 px-3 py-2 text-xs text-cyan-300 hover:bg-gray-800"
        >
          Edit
        </button>
        <button
          onClick={onSchedule}
          className="flex-1 rounded-md border border-gray-700 px-3 py-2 text-xs text-cyan-300 hover:bg-gray-800"
        >
          Schedule
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${charger.online ? 'bg-red-900/50 text-red-300 hover:bg-red-900/70' : 'bg-green-900/40 text-green-300 hover:bg-green-900/60'} disabled:opacity-60`}
        >
          {toggling ? 'Updating...' : charger.online ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {(charger.nextAvailable || charger.availableNow !== undefined) && (
        <p className="mt-2 text-[11px] text-gray-500">
          {charger.availableNow ? 'Available now' : `Next available: ${charger.nextAvailable || 'Unavailable'}`}
        </p>
      )}
    </div>
  );
}

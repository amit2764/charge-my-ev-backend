import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useNearbyHosts from '../hooks/useNearbyHosts';
import DiscoveryFilters from '../components/DiscoveryFilters';
import ChargerPin from '../components/ChargerPin';
import HostBottomSheet from '../components/HostBottomSheet';
import VerifiedBadge from '../components/VerifiedBadge';

function sortByDistance(a, b) {
  return Number(a.distance || 0) - Number(b.distance || 0);
}

export default function DiscoveryMapScreen({ onRequestCharge }) {
  const {
    location,
    radiusKm,
    setRadiusKm,
    filters,
    setFilters,
    hosts,
    loading,
    error,
    refresh
  } = useNearbyHosts(5);
  const [selectedHost, setSelectedHost] = useState(null);
  const [isListView, setIsListView] = useState(false);

  const sortedHosts = useMemo(() => [...hosts].sort(sortByDistance), [hosts]);

  const center = location ? [location.lat, location.lng] : [12.9716, 77.5946];

  return (
    <div className="relative flex h-full flex-col gap-3 p-3 md:grid md:grid-cols-[1.15fr_0.85fr] md:gap-5 md:p-5">
      <div className="relative flex flex-col gap-3">
        <div className="glass-surface relative overflow-hidden rounded-[28px] p-3 shadow-[0_18px_48px_rgba(2,6,23,0.32)]">
          <div className="absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_70%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Explore nearby chargers</p>
              <h2 className="mt-1 text-xl font-black text-white">Find the best live host</h2>
              <p className="mt-1 text-xs text-slate-400">Map-first discovery with real-time availability and distance-aware sorting.</p>
            </div>
            <button onClick={refresh} className="glass-surface shrink-0 rounded-[18px] px-3 py-3 text-xs font-semibold text-cyan-300 hover:text-white">
              📍 Auto Locate
            </button>
          </div>

          <div className="mt-3">
            <DiscoveryFilters
              filters={filters}
              onApply={setFilters}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
              isListView={isListView}
              onToggleView={() => setIsListView((v) => !v)}
            />
          </div>
        </div>

        {loading && <p className="floating-chip self-start text-cyan-300">Searching nearby hosts...</p>}
        {error && <p className="glass-surface self-start rounded-[18px] px-4 py-3 text-xs text-red-300">{error}</p>}

        {!isListView ? (
        <div className="map-shell relative min-h-[480px] flex-1 overflow-hidden rounded-[30px] border border-white/10 shadow-[0_24px_60px_rgba(2,6,23,0.34)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-center justify-between px-4 py-4">
            <div className="glass-surface rounded-[20px] px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Live map</p>
              <p className="text-sm font-bold text-white">{sortedHosts.length} chargers nearby</p>
            </div>
            <button onClick={refresh} className="pointer-events-auto glass-surface rounded-full p-3 text-sm text-cyan-300 hover:text-white">↻</button>
          </div>
          <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {location && <CircleMarker center={center} radius={8} pathOptions={{ color: '#22d3ee' }} />}

            {sortedHosts.map((host) => (
              <ChargerPin key={host.hostId} host={host} onSelect={setSelectedHost} />
            ))}
          </MapContainer>

          <HostBottomSheet
            host={selectedHost}
            onClose={() => setSelectedHost(null)}
            onRequest={(host) => {
              localStorage.setItem('discoveryPrefillHost', JSON.stringify(host));
              onRequestCharge(host);
            }}
          />
        </div>
      ) : null}
      </div>

      <div className={`${isListView ? 'flex' : 'hidden md:flex'} flex-1 overflow-y-auto rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(17,24,39,0.72))] p-3 shadow-[0_24px_60px_rgba(2,6,23,0.3)]`}>
        <div className="flex w-full flex-col">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Nearby chargers</p>
              <h3 className="text-lg font-black text-white">Premium hosts list</h3>
            </div>
            <span className="floating-chip">{radiusKm} km radius</span>
          </div>
          {sortedHosts.length === 0 && (
            <div className="glass-surface skeleton-shimmer p-6 text-sm text-gray-400">No hosts found in this area.</div>
          )}

          {sortedHosts.map((host) => (
            <button
              key={host.hostId}
              onClick={() => setSelectedHost(host)}
              className="mb-3 w-full rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(17,24,39,0.72))] p-4 text-left shadow-[0_16px_36px_rgba(2,6,23,0.22)] transition-all hover:-translate-y-0.5 hover:border-blue-400/25 hover:shadow-[0_20px_40px_rgba(59,130,246,0.14)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gradient-to-br from-blue-500/30 to-emerald-400/20 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    {String(host.name || 'H').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{host.name || 'Host Charger'}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{host.connectorType || 'Unknown connector'} • {host.powerKw || 0} kW</p>
                  </div>
                  {host.verified && <VerifiedBadge />}
                </div>
                <span className={host.available ? 'floating-chip text-emerald-300' : 'floating-chip text-gray-400'}>
                  {host.available ? 'Live now' : 'Offline'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-[18px] bg-white/5 px-2 py-2 text-slate-300">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Price</p>
                  <p className="mt-1 text-sm font-bold text-cyan-300">₹{host.pricePerUnit ?? 0}</p>
                </div>
                <div className="rounded-[18px] bg-white/5 px-2 py-2 text-slate-300">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Distance</p>
                  <p className="mt-1 text-sm font-bold text-white">{Number(host.distance || 0).toFixed(2)} km</p>
                </div>
                <div className="rounded-[18px] bg-white/5 px-2 py-2 text-slate-300">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Rating</p>
                  <p className="mt-1 text-sm font-bold text-white">★ {Number(host.rating || 0).toFixed(1)}</p>
                </div>
              </div>
            </button>
          ))}

          {selectedHost && (
            <HostBottomSheet
              host={selectedHost}
              onClose={() => setSelectedHost(null)}
              onRequest={(host) => {
                localStorage.setItem('discoveryPrefillHost', JSON.stringify(host));
                onRequestCharge(host);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

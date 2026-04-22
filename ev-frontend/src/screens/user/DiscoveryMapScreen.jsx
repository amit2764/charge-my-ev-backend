import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '../../i18n';

const FILTERS = [
  'Type 2',
  'CCS',
  'CHAdeMO',
  'Type 1',
  'Fast (>22kW)',
  'Available now',
];

/**
 * Screen 08 — Discovery Map (User, Web)
 *
 * Props:
 *   chargers: [{ id, lat, lng, status, hostName, hostAvatar, kycVerified, rating, reviewCount, distanceKm, connectorType, powerKw, pricePerKwh, pricePerHour, nextAvailableAt }]
 *   isDark: boolean
 *   filters: string[]
 *   selectedChargerId: string | null
 *   onToggleFilter(filter)
 *   onSearch()
 *   onSelectCharger(charger)
 *   onRequestCharge(charger)
 *   onGetDirections(charger)
 *   onOpenHostDetail(charger)
 *   onLocateMe(map)
 *   onToggleListView()
 */
export default function DiscoveryMapScreen({
  chargers = [],
  isDark = true,
  filters = [],
  selectedChargerId = null,
  onToggleFilter,
  onSearch,
  onSelectCharger,
  onRequestCharge,
  onGetDirections,
  onOpenHostDetail,
  onLocateMe,
  onToggleListView,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const [localSelectedId, setLocalSelectedId] = useState(selectedChargerId);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const effectiveSelectedId = selectedChargerId ?? localSelectedId;

  const filtered = useMemo(() => {
    if (!filters?.length) return chargers;
    return chargers.filter((c) => {
      return filters.every((f) => {
        if (f === 'Available now') return c.status === 'AVAILABLE';
        if (f === 'Fast (>22kW)') return Number(c.powerKw || 0) > 22;
        return (c.connectorType || '').toLowerCase().includes(f.toLowerCase());
      });
    });
  }, [chargers, filters]);

  const selected = filtered.find((c) => c.id === effectiveSelectedId) || filtered[0] || null;

  const clusteredAndSingles = useMemo(() => buildSimpleClusters(filtered), [filtered]);

  const center = useMemo(() => {
    const first = filtered[0];
    return first?.lat && first?.lng ? [first.lat, first.lng] : [28.6139, 77.209];
  }, [filtered]);

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <MapContainer center={center} zoom={13} style={s.map} zoomControl={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url={isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />

        <MapController center={center} />

        {clusteredAndSingles.map((entry) => {
          if (entry.type === 'cluster') {
            return (
              <Marker
                key={`cl-${entry.id}`}
                position={[entry.lat, entry.lng]}
                icon={clusterIcon(entry.count)}
              />
            );
          }

          const c = entry.data;
          const selectedPin = c.id === effectiveSelectedId;
          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={pinIcon(c.status, selectedPin)}
              eventHandlers={{
                click: () => {
                  setLocalSelectedId(c.id);
                  setSheetExpanded(false);
                  onSelectCharger?.(c);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Top floating search + chips */}
      <div style={s.topOverlay}>
        <button style={s.searchBar} onClick={() => onSearch?.()}>
          <SearchIcon />
          <span style={s.searchText}>{tx('map.search', isHindi ? 'स्थान या चार्जर खोजें...' : 'Search location or charger...')}</span>
        </button>

        <div style={s.chipsRow}>
          {FILTERS.map((f) => {
            const active = filters.includes(f);
            return (
              <button
                key={f}
                style={{
                  ...s.chip,
                  background: active ? '#00D4AA' : 'rgba(10,10,15,0.72)',
                  color: active ? '#0A0A0F' : 'rgba(255,255,255,0.82)',
                  borderColor: active ? '#00D4AA' : 'rgba(255,255,255,0.16)',
                }}
                onClick={() => onToggleFilter?.(f)}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating actions */}
      <div style={s.floatBtns}>
        <button style={s.floatBtn} onClick={() => onLocateMe?.()} aria-label="Locate me">
          <GpsIcon />
        </button>
        <button style={s.floatBtn} onClick={() => onToggleListView?.()} aria-label="List view">
          <ListIcon />
        </button>
      </div>

      {/* Bottom sheet */}
      {selected && (
        <div style={{ ...s.sheet, height: sheetExpanded ? '86%' : '45%' }}>
          <button style={s.sheetHandle} onClick={() => setSheetExpanded((v) => !v)} aria-label="Expand details">
            <span style={s.handleBar} />
          </button>

          <div style={s.sheetHeader}>
            <div style={s.hostLeft}>
              {selected.hostAvatar
                ? <img src={selected.hostAvatar} alt="" style={s.hostAvatar} referrerPolicy="no-referrer" />
                : <div style={s.hostAvatarFallback}>{avatarInitials(selected.hostName)}</div>}
              <div>
                <p style={s.hostName}>
                  {selected.hostName || 'Host'}
                  {selected.kycVerified && <span style={s.verifyBadge}>✔</span>}
                </p>
                <p style={s.ratingLine}>★ {selected.rating ?? 4.6} · {selected.reviewCount ?? 0} {tx('map.reviews', isHindi ? 'रिव्यू' : 'reviews')}</p>
              </div>
            </div>
          </div>

          <div style={s.badgesRow}>
            <span style={s.infoBadge}>{selected.distanceKm ?? 0} km</span>
            <span style={s.infoBadge}>{selected.connectorType || 'Type 2'}</span>
            <span style={s.infoBadge}>{selected.powerKw ?? 7} kW</span>
          </div>

          <p style={s.priceLine}>
            {selected.pricePerKwh
              ? `₹${selected.pricePerKwh} / kWh`
              : ''}
            {selected.pricePerKwh && selected.pricePerHour ? ' + ' : ''}
            {selected.pricePerHour
              ? `₹${selected.pricePerHour} / hour`
              : ''}
          </p>

          <p style={{
            ...s.availability,
            color: selected.status === 'AVAILABLE' ? '#22C55E' : '#F59E0B',
            background: selected.status === 'AVAILABLE' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.14)',
          }}>
            {selected.status === 'AVAILABLE'
              ? tx('map.availableNow', isHindi ? 'अभी उपलब्ध' : 'Available now')
              : `${tx('map.next', isHindi ? 'अगला' : 'Next')}: ${selected.nextAvailableAt || '3:00 PM'}`}
          </p>

          <div style={s.sheetActions}>
            <button style={s.ghostBtn} onClick={() => onGetDirections?.(selected)}>
              {tx('map.directions', isHindi ? 'दिशा देखें' : 'Get Directions')}
            </button>
            <button style={s.primaryBtn} onClick={() => onRequestCharge?.(selected)}>
              {tx('map.requestCharge', isHindi ? 'चार्ज रिक्वेस्ट करें' : 'Request Charge')}
            </button>
          </div>

          <button style={s.expandHint} onClick={() => onOpenHostDetail?.(selected)}>
            {tx('map.swipeForDetails', isHindi ? 'ऊपर स्वाइप करें: पूरी जानकारी' : 'Swipe up for full host detail')}
          </button>
        </div>
      )}
    </div>
  );
}

function MapController({ center }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

function buildSimpleClusters(chargers) {
  const buckets = new Map();
  const precision = 0.01; // coarse bucket for 3+ grouping

  chargers.forEach((c) => {
    const lat = Number(c.lat || 0);
    const lng = Number(c.lng || 0);
    const k = `${Math.round(lat / precision)}:${Math.round(lng / precision)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(c);
  });

  const out = [];
  buckets.forEach((arr, key) => {
    if (arr.length >= 3) {
      const lat = arr.reduce((s, c) => s + Number(c.lat || 0), 0) / arr.length;
      const lng = arr.reduce((s, c) => s + Number(c.lng || 0), 0) / arr.length;
      out.push({ type: 'cluster', id: key, lat, lng, count: arr.length });
    } else {
      arr.forEach((c) => out.push({ type: 'single', data: c }));
    }
  });

  return out;
}

function pinIcon(status = 'AVAILABLE', selected = false) {
  const color = status === 'AVAILABLE'
    ? '#00D4AA'
    : status === 'BUSY'
      ? '#F59E0B'
      : '#6B7280';

  const cls = [
    'map-pin',
    status === 'AVAILABLE' ? 'pin-pulse' : '',
    selected ? 'pin-selected' : '',
  ].join(' ').trim();

  return L.divIcon({
    className: 'leaflet-marker-no-bg',
    html: `<div class="${cls}" style="background:${color}"><span>⚡</span></div>`,
    iconSize: [selected ? 34 : 26, selected ? 34 : 26],
    iconAnchor: [selected ? 17 : 13, selected ? 17 : 13],
  });
}

function clusterIcon(count) {
  return L.divIcon({
    className: 'leaflet-marker-no-bg',
    html: `<div class="map-cluster">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function avatarInitials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function GpsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.8" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h13M8 12h13M8 18h13" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1" fill="#fff" />
      <circle cx="4" cy="12" r="1" fill="#fff" />
      <circle cx="4" cy="18" r="1" fill="#fff" />
    </svg>
  );
}

const cssText = `
  * { box-sizing: border-box; }
  .leaflet-control-attribution { font-size: 10px !important; background: rgba(0,0,0,.35) !important; color: rgba(255,255,255,.6) !important; }
  .leaflet-marker-no-bg { background: transparent; border: none; }

  .map-pin {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.28);
    border: 2px solid rgba(255,255,255,0.2);
  }
  .map-pin.pin-selected {
    width: 34px;
    height: 34px;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 4px rgba(0,212,170,.25), 0 4px 14px rgba(0,0,0,.35);
  }
  .map-pin.pin-pulse::after {
    content: '';
    position: absolute;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px solid rgba(0,212,170,0.45);
    animation: pinPulse 1.8s ease-out infinite;
  }
  .map-cluster {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #6B7280;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255,255,255,0.28);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  }

  @keyframes pinPulse {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.6); opacity: 0; }
  }
`;

const s = {
  page: {
    height: '100dvh',
    width: '100%',
    position: 'relative',
    background: '#0A0A0F',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  map: {
    height: '100%',
    width: '100%',
    zIndex: 1,
  },

  topOverlay: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 12,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    pointerEvents: 'none',
  },
  searchBar: {
    pointerEvents: 'auto',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: '12px 14px',
    background: 'rgba(10,10,15,0.84)',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
  },
  searchText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  chipsRow: {
    pointerEvents: 'auto',
    display: 'flex',
    overflowX: 'auto',
    gap: 8,
    paddingBottom: 2,
    scrollbarWidth: 'none',
  },
  chip: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(10,10,15,0.72)',
    color: 'rgba(255,255,255,0.82)',
    padding: '8px 12px',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },

  floatBtns: {
    position: 'absolute',
    right: 14,
    bottom: '48%',
    zIndex: 15,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  floatBtn: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'rgba(10,10,15,0.86)',
    border: '1px solid rgba(255,255,255,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    background: 'rgba(10,10,15,0.98)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTop: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.36)',
    padding: '6px 16px 20px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'height 220ms ease',
  },
  sheetHandle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0 12px',
  },
  handleBar: {
    width: 42,
    height: 5,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.25)',
  },
  sheetHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
  hostLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  hostAvatar: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' },
  hostAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(0,212,170,0.2)',
    color: '#00D4AA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  hostName: { margin: '0 0 2px', color: '#fff', fontSize: 15, fontWeight: 700 },
  verifyBadge: {
    marginLeft: 6,
    fontSize: 11,
    padding: '1px 5px',
    borderRadius: 999,
    color: '#0A0A0F',
    background: '#00D4AA',
    verticalAlign: 'middle',
  },
  ratingLine: { margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  badgesRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  infoBadge: {
    borderRadius: 999,
    padding: '5px 10px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
  },

  priceLine: { margin: '0 0 10px', color: '#fff', fontSize: 14, fontWeight: 700 },
  availability: {
    margin: '0 0 14px',
    display: 'inline-flex',
    alignSelf: 'flex-start',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
  },

  sheetActions: { display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10, marginBottom: 12 },
  ghostBtn: {
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.22)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.92)',
    padding: '12px 10px',
    fontWeight: 600,
  },
  primaryBtn: {
    borderRadius: 10,
    background: '#00D4AA',
    color: '#0A0A0F',
    padding: '12px 10px',
    fontWeight: 700,
  },
  expandHint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    padding: '6px 0',
  },
};

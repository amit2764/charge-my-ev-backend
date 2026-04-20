import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

function connectorEmoji(connectorType) {
  const type = String(connectorType || '').toLowerCase();
  if (type.includes('ccs')) return '🔌';
  if (type.includes('type2')) return '⚡';
  if (type.includes('gbt')) return '🔋';
  return '📍';
}

function createPinIcon(host) {
  const onlineClass = host.available ? 'bg-green-500' : 'bg-gray-500';
  const iconHtml = `
    <div style="position:relative;transform:translate(-50%, -100%);">
      <div style="background:#111827;border:1px solid #374151;color:#e5e7eb;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;">
        <span>${connectorEmoji(host.connectorType)}</span>
        <span>${host.pricePerUnit ?? 0}</span>
        <span style="width:8px;height:8px;border-radius:999px;display:inline-block;" class="${onlineClass}"></span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-charger-pin',
    html: iconHtml,
    iconSize: [88, 28],
    iconAnchor: [44, 28]
  });
}

export default function ChargerPin({ host, onSelect }) {
  if (!host?.location?.lat || !host?.location?.lng) return null;

  return (
    <Marker
      position={[host.location.lat, host.location.lng]}
      icon={createPinIcon(host)}
      eventHandlers={{ click: () => onSelect(host) }}
    >
      <Tooltip direction="top" offset={[0, -28]} opacity={0.95}>
        {host.name || 'Host'}
      </Tooltip>
    </Marker>
  );
}

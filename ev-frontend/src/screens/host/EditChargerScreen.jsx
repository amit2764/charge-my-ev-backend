import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CONNECTOR_OPTIONS = ['Type 1', 'Type 2', 'CCS', 'CHAdeMO'];
const PRICING_OPTIONS = ['per kWh', 'per hour', 'flat'];

function MapPicker({ position, onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });

  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

export default function EditChargerScreen({ charger, onCancel, onUpdate }) {
  const [form, setForm] = useState({
    connectorType: charger.connectorType || 'Type 2',
    powerKw: String(charger.powerKw || ''),
    pricingMode: charger.pricingMode || 'per hour',
    price: String(charger.price || ''),
    address: charger.address || '',
    description: charger.description || '',
    lat: String(charger.lat || ''),
    lng: String(charger.lng || ''),
    existingPhotos: charger.photos || []
  });
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mapPos = useMemo(() => {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [form.lat, form.lng]);

  const submit = async () => {
    if (!form.address || !form.powerKw || !form.price || !mapPos) {
      setError('Please fill all required fields and pick map location.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'existingPhotos') {
          fd.append('existingPhotos', JSON.stringify(value || []));
        } else {
          fd.append(key, String(value));
        }
      });
      photos.slice(0, 4).forEach((file) => fd.append('photos', file));
      await onUpdate(fd);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to update charger.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <h3 className="text-base font-bold text-white">Edit Charger</h3>
      {error && <p className="rounded-md border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <select value={form.connectorType} onChange={(e) => setForm((p) => ({ ...p, connectorType: e.target.value }))} className="rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white">
          {CONNECTOR_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <input placeholder="Power (kW)" value={form.powerKw} onChange={(e) => setForm((p) => ({ ...p, powerKw: e.target.value.replace(/[^\d.]/g, '') }))} className="rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white" />
        <select value={form.pricingMode} onChange={(e) => setForm((p) => ({ ...p, pricingMode: e.target.value }))} className="rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white">
          {PRICING_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <input placeholder="Price" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value.replace(/[^\d.]/g, '') }))} className="rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white" />
      </div>

      <input placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="w-full rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white" />
      <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white" rows={3} />

      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Latitude" value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))} className="rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white" />
        <input placeholder="Longitude" value={form.lng} onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))} className="rounded-md border border-gray-700 bg-black px-2 py-2 text-xs text-white" />
      </div>

      <div className="h-52 overflow-hidden rounded-lg border border-gray-700">
        <MapContainer center={mapPos ? [mapPos.lat, mapPos.lng] : [12.9716, 77.5946]} zoom={13} className="h-full w-full">
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapPicker position={mapPos} onPick={(p) => setForm((prev) => ({ ...prev, lat: String(p.lat), lng: String(p.lng) }))} />
        </MapContainer>
      </div>

      <div className="text-xs text-gray-400">
        Existing photos: {(form.existingPhotos || []).length}
      </div>
      <input type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []).slice(0, 4))} className="w-full text-xs text-gray-400" />

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex-1 rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-60">{saving ? 'Saving...' : 'Update Charger'}</button>
      </div>
    </div>
  );
}

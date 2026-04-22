import React, { useMemo, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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
 * Screen 08 — Discovery Map (User, Native)
 * Props mirror web version.
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
  const [expanded, setExpanded] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));

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

  const clusterAndSingles = useMemo(() => buildSimpleClusters(filtered), [filtered]);

  const initialRegion = useMemo(() => {
    const first = filtered[0];
    return {
      latitude: Number(first?.lat || 28.6139),
      longitude: Number(first?.lng || 77.209),
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [filtered]);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const [pan] = useState(() => new Animated.Value(0));
  const [panResponder] = useState(() => PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) pan.setValue(Math.max(g.dy, -120));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -50) {
          setExpanded(true);
          onOpenHostDetail?.(selected);
        }
        Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      },
    }));

  return (
    <View style={s.page}>
      <MapView
        style={s.map}
        initialRegion={initialRegion}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
        showsUserLocation
      >
        {clusterAndSingles.map((entry) => {
          if (entry.type === 'cluster') {
            return (
              <Marker key={`cl-${entry.id}`} coordinate={{ latitude: entry.lat, longitude: entry.lng }}>
                <View style={s.clusterPin}>
                  <Text style={s.clusterText}>{entry.count}</Text>
                </View>
              </Marker>
            );
          }

          const c = entry.data;
          const selectedPin = c.id === effectiveSelectedId;
          const status = c.status || 'OFFLINE';
          const color = status === 'AVAILABLE' ? '#00D4AA' : status === 'BUSY' ? '#F59E0B' : '#6B7280';

          return (
            <Marker
              key={c.id}
              coordinate={{ latitude: Number(c.lat), longitude: Number(c.lng) }}
              onPress={() => {
                setLocalSelectedId(c.id);
                setExpanded(false);
                onSelectCharger?.(c);
              }}
            >
              <View style={[
                s.pin,
                selectedPin && s.pinSelected,
                { backgroundColor: color },
              ]}>
                <Text style={s.pinBolt}>⚡</Text>
                {status === 'AVAILABLE' && (
                  <Animated.View style={[s.pinPulse, { opacity: pulse }]} />
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top overlays */}
      <View style={s.topOverlay} pointerEvents="box-none">
        <TouchableOpacity style={s.searchBar} onPress={() => onSearch?.()} activeOpacity={0.85}>
          <Text style={s.searchIcon}>🔍</Text>
          <Text style={s.searchText}>{tx('map.search', isHindi ? 'स्थान या चार्जर खोजें...' : 'Search location or charger...')}</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow}>
          {FILTERS.map((f) => {
            const active = filters.includes(f);
            return (
              <TouchableOpacity
                key={f}
                style={[
                  s.chip,
                  active ? s.chipActive : s.chipGhost,
                ]}
                onPress={() => onToggleFilter?.(f)}
                activeOpacity={0.85}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Floating buttons */}
      <View style={s.floatBtns}>
        <TouchableOpacity style={s.floatBtn} onPress={() => onLocateMe?.()} activeOpacity={0.8}>
          <Text style={s.floatIcon}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.floatBtn} onPress={() => onToggleListView?.()} activeOpacity={0.8}>
          <Text style={s.floatIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom sheet */}
      {selected && (
        <View style={[s.sheet, { height: expanded ? '86%' : '45%' }]}>
          <Animated.View style={{ transform: [{ translateY: pan }] }} {...panResponder.panHandlers}>
            <TouchableOpacity style={s.handleArea} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
              <View style={s.handleBar} />
            </TouchableOpacity>
          </Animated.View>

          <View style={s.sheetHeader}>
            <View style={s.hostLeft}>
              {selected.hostAvatar
                ? <Image source={{ uri: selected.hostAvatar }} style={s.hostAvatar} />
                : <View style={s.hostAvatarFallback}><Text style={s.hostAvatarFallbackText}>{avatarInitials(selected.hostName)}</Text></View>}
              <View>
                <Text style={s.hostName}>
                  {selected.hostName || 'Host'}
                  {selected.kycVerified ? <Text style={s.verifyBadge}>  ✔</Text> : null}
                </Text>
                <Text style={s.ratingLine}>★ {selected.rating ?? 4.6} · {selected.reviewCount ?? 0} {tx('map.reviews', isHindi ? 'रिव्यू' : 'reviews')}</Text>
              </View>
            </View>
          </View>

          <View style={s.badgesRow}>
            <Text style={s.infoBadge}>{selected.distanceKm ?? 0} km</Text>
            <Text style={s.infoBadge}>{selected.connectorType || 'Type 2'}</Text>
            <Text style={s.infoBadge}>{selected.powerKw ?? 7} kW</Text>
          </View>

          <Text style={s.priceLine}>
            {selected.pricePerKwh ? `₹${selected.pricePerKwh} / kWh` : ''}
            {selected.pricePerKwh && selected.pricePerHour ? ' + ' : ''}
            {selected.pricePerHour ? `₹${selected.pricePerHour} / hour` : ''}
          </Text>

          <Text style={[
            s.availability,
            selected.status === 'AVAILABLE' ? s.availNow : s.availNext,
          ]}>
            {selected.status === 'AVAILABLE'
              ? tx('map.availableNow', isHindi ? 'अभी उपलब्ध' : 'Available now')
              : `${tx('map.next', isHindi ? 'अगला' : 'Next')}: ${selected.nextAvailableAt || '3:00 PM'}`}
          </Text>

          <View style={s.sheetActions}>
            <TouchableOpacity style={s.ghostBtn} onPress={() => onGetDirections?.(selected)} activeOpacity={0.85}>
              <Text style={s.ghostBtnText}>{tx('map.directions', isHindi ? 'दिशा देखें' : 'Get Directions')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={() => onRequestCharge?.(selected)} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>{tx('map.requestCharge', isHindi ? 'चार्ज रिक्वेस्ट करें' : 'Request Charge')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.expandHint} onPress={() => onOpenHostDetail?.(selected)} activeOpacity={0.7}>
            <Text style={s.expandHintText}>{tx('map.swipeForDetails', isHindi ? 'ऊपर स्वाइप करें: पूरी जानकारी' : 'Swipe up for full host detail')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function buildSimpleClusters(chargers) {
  const buckets = new Map();
  const precision = 0.01;

  chargers.forEach((c) => {
    const lat = Number(c.lat || 0);
    const lng = Number(c.lng || 0);
    const key = `${Math.round(lat / precision)}:${Math.round(lng / precision)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
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

function avatarInitials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0A0F' },
  map: { ...StyleSheet.absoluteFillObject },

  topOverlay: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 12,
    zIndex: 10,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(10,10,15,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchIcon: { fontSize: 14 },
  searchText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  chipsRow: { marginTop: 2 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  chipGhost: {
    backgroundColor: 'rgba(10,10,15,0.72)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  chipActive: {
    backgroundColor: '#00D4AA',
    borderColor: '#00D4AA',
  },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.82)' },
  chipTextActive: { color: '#0A0A0F', fontWeight: '700' },

  floatBtns: {
    position: 'absolute',
    right: 14,
    bottom: '48%',
    zIndex: 12,
    gap: 10,
  },
  floatBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10,10,15,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatIcon: { color: '#fff', fontSize: 17 },

  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  pinSelected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: '#fff',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pinBolt: { color: '#fff', fontSize: 12 },
  pinPulse: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(0,212,170,0.45)',
    transform: [{ scale: 1.4 }],
  },

  clusterPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B7280',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,15,0.98)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  handleArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  sheetHeader: { marginBottom: 12 },
  hostLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostAvatar: { width: 44, height: 44, borderRadius: 22 },
  hostAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,212,170,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarFallbackText: { color: '#00D4AA', fontWeight: '700' },
  hostName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  verifyBadge: { color: '#00D4AA', fontSize: 12 },
  ratingLine: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  infoBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
  },

  priceLine: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  availability: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 14,
  },
  availNow: { color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.12)' },
  availNext: { color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.14)' },

  sheetActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  ghostBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ghostBtnText: { color: 'rgba(255,255,255,0.92)', fontWeight: '600' },
  primaryBtn: {
    flex: 1.2,
    borderRadius: 10,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#0A0A0F', fontWeight: '700' },

  expandHint: { alignItems: 'center', paddingVertical: 6 },
  expandHintText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
});

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#12141a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e94a5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#12141a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1d2029' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1a24' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1f28' }] },
];

const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f3f5f8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
];

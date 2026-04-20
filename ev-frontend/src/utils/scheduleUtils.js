const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeTime(value) {
  const raw = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeDay(day = {}) {
  return {
    available: !!day.available,
    start: normalizeTime(day.start) || '09:00',
    end: normalizeTime(day.end) || '21:00'
  };
}

export function normalizeSchedule(schedule = {}) {
  return {
    mon: normalizeDay(schedule.mon),
    tue: normalizeDay(schedule.tue),
    wed: normalizeDay(schedule.wed),
    thu: normalizeDay(schedule.thu),
    fri: normalizeDay(schedule.fri),
    sat: normalizeDay(schedule.sat),
    sun: normalizeDay(schedule.sun)
  };
}

function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

function isInDayWindow(day, nowMinutes) {
  if (!day.available) return false;
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);
  if (start === null || end === null) return false;
  if (start === end) return true;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

export function isChargerAvailableNow(schedule, now = new Date()) {
  const normalized = normalizeSchedule(schedule);
  const key = DAY_KEYS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return isInDayWindow(normalized[key], nowMinutes);
}

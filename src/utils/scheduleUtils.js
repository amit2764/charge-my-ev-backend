const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeTime(value) {
  const raw = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const min = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeDay(day = {}) {
  const available = !!day.available;
  const start = normalizeTime(day.start) || '09:00';
  const end = normalizeTime(day.end) || '21:00';
  return { available, start, end };
}

function normalizeSchedule(schedule = {}) {
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

function isInDayWindow(day, nowMinutes) {
  if (!day.available) return false;
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);
  if (start === null || end === null) return false;
  if (start === end) return true;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

function isChargerAvailableNow(schedule, now = new Date()) {
  const normalized = normalizeSchedule(schedule);
  const dayKey = DAY_KEYS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return isInDayWindow(normalized[dayKey], nowMinutes);
}

function getNextAvailable(schedule, now = new Date()) {
  const normalized = normalizeSchedule(schedule);
  const startDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIdx = (startDay + offset) % 7;
    const dayKey = DAY_KEYS[dayIdx];
    const day = normalized[dayKey];
    if (!day.available) continue;

    const start = timeToMinutes(day.start);
    const end = timeToMinutes(day.end);
    if (start === null || end === null) continue;

    if (offset === 0) {
      if (isInDayWindow(day, nowMinutes)) return 'Available now';
      if (start < end && nowMinutes < start) return `Today ${minutesToTime(start)}`;
      if (start > end && nowMinutes < start && nowMinutes >= end) return `Today ${minutesToTime(start)}`;
      continue;
    }

    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${names[dayIdx]} ${minutesToTime(start)}`;
  }

  return 'Unavailable';
}

module.exports = {
  normalizeSchedule,
  isChargerAvailableNow,
  getNextAvailable
};

const PIN_SALT = 'ev_charge_pin_v2';

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export async function hashPin(pin) {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be exactly 4 digits');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`${pin}:${PIN_SALT}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export async function verifyPin(pin, expectedHash) {
  if (!expectedHash || !isValidPin(pin)) return false;
  const computed = await hashPin(pin);
  return computed === expectedHash;
}

import { useEffect, useMemo, useState } from 'react';
import useBiometric from '../hooks/useBiometric';
import { verifyPin } from '../utils/pinHash';

const MAX_ATTEMPTS = 5;

function readFailureCount() {
  const raw = Number(localStorage.getItem('quickUnlockFailures') || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function writeFailureCount(next) {
  localStorage.setItem('quickUnlockFailures', String(next));
}

export default function PINUnlock({ rememberedUser, onSuccess, onForceOtp }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricTried, setBiometricTried] = useState(false);
  const { isSupported, authenticateBiometric } = useBiometric();

  const pinHash = useMemo(() => localStorage.getItem('pinHash') || '', []);
  const biometricId = useMemo(() => localStorage.getItem('biometricCredentialId') || '', []);

  useEffect(() => {
    if (!rememberedUser || !pinHash) {
      onForceOtp();
      return;
    }

    const failures = readFailureCount();
    if (failures >= MAX_ATTEMPTS) {
      onForceOtp();
    }
  }, [rememberedUser, pinHash, onForceOtp]);

  useEffect(() => {
    const tryBiometric = async () => {
      if (!isSupported || !biometricId || biometricTried) return;

      setBiometricTried(true);
      try {
        const ok = await authenticateBiometric(biometricId);
        if (ok) {
          writeFailureCount(0);
          onSuccess(rememberedUser);
        }
      } catch {
        setError('Biometric failed. Enter PIN to continue.');
      }
    };

    tryBiometric();
  }, [isSupported, biometricId, biometricTried, authenticateBiometric, onSuccess, rememberedUser]);

  const handlePinUnlock = async () => {
    if (pin.length !== 4) {
      setError('Enter 4-digit PIN.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const ok = await verifyPin(pin, pinHash);
      if (ok) {
        writeFailureCount(0);
        onSuccess(rememberedUser);
        return;
      }

      const nextFailures = readFailureCount() + 1;
      writeFailureCount(nextFailures);

      if (nextFailures >= MAX_ATTEMPTS) {
        setError('Too many failed attempts. Please verify with phone OTP.');
        onForceOtp();
        return;
      }

      setError(`Incorrect PIN. Attempts left: ${MAX_ATTEMPTS - nextFailures}`);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-start overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_42%),linear-gradient(180deg,#020617,#0f172a)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] text-gray-200 sm:justify-center md:min-h-screen">
      <div className="glass-surface rounded-[28px] p-5 shadow-[0_24px_60px_rgba(2,6,23,0.4)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Quick unlock</p>
        <h1 className="mt-1 text-xl font-black text-white">Unlock</h1>
        <p className="mt-2 text-sm text-gray-400">{rememberedUser || 'Saved account'}</p>

        {isSupported && biometricId && (
          <button
            onClick={async () => {
              setLoading(true);
              setError('');
              try {
                const ok = await authenticateBiometric(biometricId);
                if (ok) {
                  writeFailureCount(0);
                  onSuccess(rememberedUser);
                }
              } catch {
                setError('Biometric failed. Enter PIN to continue.');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="mt-4 w-full rounded-[18px] border border-cyan-400/40 bg-cyan-900/20 px-4 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-900/35 disabled:opacity-60"
          >
            Use biometric
          </button>
        )}

        {error && <p className="mt-3 rounded-md border border-red-800 bg-red-950/50 p-2 text-sm text-red-300">{error}</p>}

        <div className="mt-4">
          <label className="mb-1 block text-xs text-gray-500">PIN</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 p-3 text-center text-2xl tracking-[0.45em] text-white outline-none"
            placeholder="••••"
          />
        </div>

        <button
          onClick={handlePinUnlock}
          disabled={loading}
          className="mt-4 w-full rounded-[18px] bg-gradient-to-r from-blue-500 to-cyan-300 px-4 py-3 font-bold text-slate-950 shadow-[0_14px_30px_rgba(59,130,246,0.28)] transition hover:shadow-[0_18px_38px_rgba(59,130,246,0.32)] disabled:opacity-60"
        >
          {loading ? 'Unlocking...' : 'Unlock with PIN'}
        </button>

        <button
          onClick={onForceOtp}
          className="mt-3 w-full text-center text-sm text-cyan-300 hover:text-cyan-200"
        >
          Use phone number instead
        </button>
      </div>
    </div>
  );
}

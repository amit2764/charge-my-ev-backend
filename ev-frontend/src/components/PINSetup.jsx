import { useState } from 'react';
import useBiometric from '../hooks/useBiometric';
import { hashPin, isValidPin } from '../utils/pinHash';

export default function PINSetup({ userId, onComplete, onUsePhone }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isSupported, registerBiometric } = useBiometric();

  const handleSavePin = async () => {
    setError('');

    if (!isValidPin(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PIN does not match.');
      return;
    }

    setLoading(true);
    try {
      const pinHash = await hashPin(pin);
      localStorage.setItem('pinHash', pinHash);
      localStorage.setItem('authUser', String(userId));

      if (isSupported) {
        try {
          const credentialId = await registerBiometric(String(userId));
          localStorage.setItem('biometricCredentialId', credentialId);
        } catch {
          // PIN remains active fallback even if biometric enrollment fails.
        }
      }

      onComplete();
    } catch (e) {
      setError(e.message || 'Failed to set PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-start overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_42%),linear-gradient(180deg,#020617,#0f172a)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] text-gray-200 sm:justify-center md:min-h-screen">
      <div className="glass-surface rounded-[28px] p-5 shadow-[0_24px_60px_rgba(2,6,23,0.4)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Security setup</p>
        <h1 className="mt-1 text-xl font-black text-white">Set your quick unlock PIN</h1>
        <p className="mt-2 text-sm text-gray-400">Use a 4-digit PIN for faster login on this device.</p>

        {error && <p className="mt-3 rounded-md border border-red-800 bg-red-950/50 p-2 text-sm text-red-300">{error}</p>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">New PIN</label>
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

          <div>
            <label className="mb-1 block text-xs text-gray-500">Confirm PIN</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 p-3 text-center text-2xl tracking-[0.45em] text-white outline-none"
              placeholder="••••"
            />
          </div>
        </div>

        <button
          onClick={handleSavePin}
          disabled={loading}
          className="mt-4 w-full rounded-[18px] bg-gradient-to-r from-blue-500 to-cyan-300 px-4 py-3 font-bold text-slate-950 shadow-[0_14px_30px_rgba(59,130,246,0.28)] transition hover:shadow-[0_18px_38px_rgba(59,130,246,0.32)] disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Save PIN'}
        </button>

        <button
          onClick={onUsePhone}
          className="mt-3 w-full text-center text-sm text-cyan-300 hover:text-cyan-200"
        >
          Use phone number instead
        </button>
      </div>
    </div>
  );
}

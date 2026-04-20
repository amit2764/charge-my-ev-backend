import { useMemo } from 'react';

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomChallenge(size = 32) {
  return crypto.getRandomValues(new Uint8Array(size));
}

export default function useBiometric() {
  const isSupported = useMemo(() => {
    return (
      window.isSecureContext &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator.credentials?.create === 'function' &&
      typeof navigator.credentials?.get === 'function'
    );
  }, []);

  const registerBiometric = async (userId) => {
    if (!isSupported) {
      throw new Error('Biometric is not supported on this device');
    }

    const userBytes = new TextEncoder().encode(String(userId));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: {
          name: 'Charge My EV',
          id: window.location.hostname
        },
        user: {
          id: userBytes,
          name: String(userId),
          displayName: 'EV User'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });

    return bytesToBase64(new Uint8Array(credential.rawId));
  };

  const authenticateBiometric = async (credentialIdB64) => {
    if (!isSupported || !credentialIdB64) return false;

    await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        rpId: window.location.hostname,
        allowCredentials: [
          {
            id: base64ToBytes(credentialIdB64),
            type: 'public-key'
          }
        ],
        userVerification: 'required',
        timeout: 60000
      }
    });

    return true;
  };

  return {
    isSupported,
    registerBiometric,
    authenticateBiometric
  };
}

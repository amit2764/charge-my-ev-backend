import { useState } from 'react';
import api from './api';

export default function Login({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Normalize whitespace and ensure phone number has country code
      const cleanedPhone = phone.trim().replace(/\s+/g, '');
      const formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`;
      
      // Call your live Render backend!
      await api.post('/api/auth/send-otp', { phone: formattedPhone });
      
      setStep('otp');
      setPhone(formattedPhone);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Call your live Render backend!
      const response = await api.post('/api/auth/verify-otp', { phone, otp });
      
      if (response.data.success) {
        onLoginSuccess(phone);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Basic clean styles
  const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif' },
    card: { backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '320px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
    title: { textAlign: 'center', color: '#333', marginBottom: '1.5rem' },
    input: { width: '100%', padding: '12px', margin: '8px 0 16px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '16px' },
    button: { width: '100%', padding: '12px', backgroundColor: '#2E7D32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#A5D6A7', cursor: 'not-allowed' },
    error: { color: '#D32F2F', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Charge My EV ⚡</h2>
        
        {error && <div style={styles.error}>{error}</div>}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp}>
            <label style={{ fontSize: '14px', color: '#555' }}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <button 
              type="submit" 
              style={{...styles.button, ...(loading ? styles.buttonDisabled : {})}}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <label style={{ fontSize: '14px', color: '#555' }}>Enter 6-digit OTP sent to {phone}</label>
            <input
              style={styles.input}
              type="text"
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
            />
            <button type="submit" style={{...styles.button, ...(loading ? styles.buttonDisabled : {})}} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
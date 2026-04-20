import { useState } from 'react';
import api from '../api';

export default function usePromoCode() {
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [discount, setDiscount] = useState(null);
  const [appliedCode, setAppliedCode] = useState('');

  const validateCode = async (code) => {
    if (!code || !String(code).trim()) {
      setError('');
      setDiscount(null);
      setAppliedCode('');
      return null;
    }

    setValidating(true);
    setError('');
    try {
      const response = await api.post('/api/promo/validate', {
        code: String(code).trim()
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Invalid code');
      }

      const discountData = response.data.discount || {};
      setDiscount(discountData);
      setAppliedCode(String(code).trim());
      return discountData;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Code validation failed';
      setError(message);
      setDiscount(null);
      setAppliedCode('');
      return null;
    } finally {
      setValidating(false);
    }
  };

  const clearCode = () => {
    setError('');
    setDiscount(null);
    setAppliedCode('');
  };

  return {
    validating,
    error,
    discount,
    appliedCode,
    validateCode,
    clearCode
  };
}

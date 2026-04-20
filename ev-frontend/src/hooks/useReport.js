import { useState } from 'react';
import api from '../api';

export default function useReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitReport = async ({ reportedBy, reportedUserId, bookingId, reason, details }) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/reports', {
        reportedBy,
        reportedUserId,
        bookingId,
        reason,
        details
      });
      return response.data || { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to submit report';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async ({ hostId, blockedUserId }) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/blocks', { hostId, blockedUserId });
      return response.data || { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to block user';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async ({ hostId, blockedUserId }) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.delete(`/api/blocks/${encodeURIComponent(blockedUserId)}`, {
        params: { hostId }
      });
      return response.data || { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to unblock user';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const getBlockedUsers = async ({ hostId }) => {
    try {
      const response = await api.get('/api/blocks', { params: { hostId } });
      return Array.isArray(response.data?.blocks) ? response.data.blocks : [];
    } catch {
      return [];
    }
  };

  return {
    loading,
    error,
    submitReport,
    blockUser,
    unblockUser,
    getBlockedUsers
  };
}

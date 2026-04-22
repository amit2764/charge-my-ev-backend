/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const api = useMemo(() => ({
    show: (message, options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next = { id, type: options.type || 'info', message, duration: options.duration || 2500 };
      setToasts((prev) => [...prev, next]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, next.duration);
    },
    dismiss: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={api.dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || { show: () => {}, dismiss: () => {} };
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8, zIndex: 1400 }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

export function Toast({ toast, onClose }) {
  const { tokens } = useTheme();
  const { colors, radius, typography, shadows } = tokens;

  const tones = {
    info: { bg: colors.infoBg, fg: colors.info },
    success: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning },
    error: { bg: colors.errorBg, fg: colors.error },
  };
  const tone = tones[toast.type] || tones.info;

  return (
    <div
      role="status"
      style={{
        minWidth: 260,
        maxWidth: 360,
        borderRadius: radius.md,
        border: `1px solid ${colors.borderStrong}`,
        background: tone.bg,
        color: tone.fg,
        boxShadow: shadows.md,
        padding: '10px 12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        alignItems: 'start',
        animation: 'toast-in 180ms ease-out',
      }}
    >
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ fontSize: typography.size.sm }}>{toast.message}</div>
      <button
        type="button"
        onClick={onClose}
        style={{
          border: 'none',
          background: 'transparent',
          color: tone.fg,
          cursor: 'pointer',
          fontWeight: typography.weight.bold,
        }}
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}

ToastProvider.propTypes = { children: PropTypes.node };

ToastViewport.propTypes = {
  toasts: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

Toast.propTypes = {
  toast: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    message: PropTypes.node,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ToastProvider;

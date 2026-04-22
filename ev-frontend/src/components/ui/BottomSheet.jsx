/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

const BottomSheetContext = createContext(null);

export function BottomSheetProvider({ children }) {
  const [state, setState] = useState({ open: false, title: '', content: null });

  const api = useMemo(() => ({
    open: (payload = {}) => setState({ open: true, title: payload.title || '', content: payload.content || null }),
    close: () => setState((prev) => ({ ...prev, open: false })),
  }), []);

  return (
    <BottomSheetContext.Provider value={api}>
      {children}
      <BottomSheet open={state.open} title={state.title} onClose={api.close}>{state.content}</BottomSheet>
    </BottomSheetContext.Provider>
  );
}

export function useBottomSheet() {
  return useContext(BottomSheetContext) || { open: () => {}, close: () => {} };
}

export default function BottomSheet({ open = false, onClose, title, children, snap = 0.72 }) {
  const { tokens } = useTheme();
  const { colors, radius, typography, shadows } = tokens;

  useEffect(() => {
    if (open && typeof document !== 'undefined') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: colors.overlay,
          opacity: open ? 1 : 0,
          transition: 'opacity 200ms',
          zIndex: 1090,
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${Math.round(snap * 100)}dvh`,
          borderRadius: `${radius.lg}px ${radius.lg}px 0 0`,
          background: colors.surfaceRaised,
          border: `1px solid ${colors.borderStrong}`,
          boxShadow: shadows.lg,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 280ms cubic-bezier(0.2,0.9,0.2,1)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          zIndex: 1100,
        }}
      >
        <header style={{ borderBottom: `1px solid ${colors.border}`, padding: '10px 14px 8px' }}>
          <div style={{ margin: '0 auto 8px', width: 36, height: 4, borderRadius: radius.full, background: colors.borderStrong }} />
          {title && (
            <div style={{ fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text }}>
              {title}
            </div>
          )}
        </header>
        <div style={{ overflowY: 'auto', padding: 14 }}>{children}</div>
      </section>
    </>
  );
}

BottomSheetProvider.propTypes = { children: PropTypes.node };

BottomSheet.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.node,
  children: PropTypes.node,
  snap: PropTypes.number,
};

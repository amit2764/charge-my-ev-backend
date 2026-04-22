import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { colorTokens, getColors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';
import { shadows } from './shadows';

const THEME_STORAGE_KEY = 'ev-theme-mode';

function detectSystemMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialMode() {
  if (typeof window === 'undefined') return 'dark';
  const persisted = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (persisted === 'dark' || persisted === 'light') return persisted;
  return detectSystemMode();
}

function persistMode(nextMode) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode);

  const setMode = useCallback((nextMode) => {
    const resolved = nextMode === 'light' ? 'light' : 'dark';
    persistMode(resolved);
    setModeState(resolved);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      persistMode(next);
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const colors = getColors(mode);
    return {
      mode,
      isDark: mode === 'dark',
      tokens: {
        colors,
        typography,
        spacing,
        radius,
        shadows: mode === 'dark' ? shadows.dark : shadows.light,
      },
      setMode,
      toggleMode,
    };
  }, [mode, setMode, toggleMode]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context) return context;

  const mode = getInitialMode();
  return {
    mode,
    isDark: mode === 'dark',
    tokens: {
      colors: getColors(mode),
      typography,
      spacing,
      radius,
      shadows: mode === 'dark' ? shadows.dark : shadows.light,
    },
    setMode: persistMode,
    toggleMode: () => persistMode(mode === 'dark' ? 'light' : 'dark'),
  };
}

export function formatINR(amount) {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatKwh(kwh) {
  return `${Number(kwh || 0).toFixed(2)} kWh`;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function getGreeting(name = '') {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}, ${name}`;
}

export { colorTokens, getColors, typography, spacing, radius, shadows };

export default {
  colorTokens,
  getColors,
  typography,
  spacing,
  radius,
  shadows,
  ThemeProvider,
  useTheme,
};

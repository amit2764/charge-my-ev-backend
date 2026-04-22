// useTheme — reads dark mode preference and returns themed color/shadow helpers
// Components import this to get mode-aware tokens

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { colorTokens as colors } from '../theme/colors';
import { shadows } from '../theme/shadows';

export const useThemeStore = create(
  persist(
    (set) => ({
      isDark: true,
      toggleTheme: () => set((s) => ({ isDark: !s.isDark })),
      setDark: (val) => set({ isDark: val }),
    }),
    { name: 'ev-theme' }
  )
);

export function useTheme() {
  const { isDark, toggleTheme, setDark } = useThemeStore();
  const c = isDark ? colors.dark : colors.light;
  const s = isDark ? shadows.dark : shadows.light;

  return {
    isDark,
    toggleTheme,
    setDark,
    c,          // full current-mode color map
    shadows: s,
    // Named shorthands matching colorTokens keys
    page:             c.page,
    surface:          c.surface,
    surfaceRaised:    c.surfaceRaised,
    surfaceInverse:   c.surfaceInverse,
    border:           c.border,
    borderStrong:     c.borderStrong,
    text:             c.text,
    textMuted:        c.textMuted,
    textSoft:         c.textSoft,
    brandPrimary:     c.brandPrimary,
    brandPrimarySoft: c.brandPrimarySoft,
    brandSecondary:   c.brandSecondary,
    success:          c.success,
    successSoft:      c.successSoft,
    error:            c.error,
    errorSoft:        c.errorSoft,
    warning:          c.warning,
    overlay:          c.overlay,
    skeletonBase:     c.skeletonBase,
    skeletonHighlight:c.skeletonHighlight,
    toastBg:          c.toastBg,
    toastBorder:      c.toastBorder,
  };
}

export default useTheme;

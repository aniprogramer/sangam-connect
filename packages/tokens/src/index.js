/**
 * @sangam/tokens — Single source of truth for design tokens.
 * Consumable by Web (CSS/JS) and React Native (StyleSheet).
 */

export const colors = {
  dark: {
    bgApp: "#14120F",
    bgSidebar: "#1B1814",
    bgSurface: "#221E19",
    bgElevated: "#2C271F",
    bgOverlay: "rgba(22, 19, 16, 0.95)",
    bgCard: "rgba(28, 24, 20, 0.85)",
    bgCardHover: "rgba(38, 32, 26, 0.95)",
    bgSubtle: "rgba(255, 255, 255, 0.04)",
    inputBg: "#14110E",
    inputBorder: "rgba(255, 255, 255, 0.09)",
    border: "#3A3329",
    borderStrong: "#4D4537",
    textPrimary: "#F3EEE6",
    textSecondary: "#A9A092",
    textMuted: "#716A5D",
    accent: "#FF7A59",
    accentHover: "#FF8E71",
    accentText: "#1A0E09",
    accentSoft: "rgba(255, 122, 89, 0.14)",
    accentGlow: "rgba(255, 122, 89, 0.35)",
    speaking: "#5FD39A",
    online: "#7BC47F",
    idle: "#F5C451",
    dnd: "#FF5C5C",
    danger: "#FF5C5C",
    dangerSoft: "rgba(255, 92, 92, 0.14)",
    info: "#7FB8E6",
  },
  light: {
    bgApp: "#FCF8F4",
    bgSidebar: "#F5EFE6",
    bgSurface: "#FFFFFF",
    bgElevated: "#FDF9F5",
    bgOverlay: "rgba(252, 248, 244, 0.95)",
    bgCard: "#FFFFFF",
    bgCardHover: "#FAF5EE",
    bgSubtle: "rgba(0, 0, 0, 0.03)",
    inputBg: "#FFFFFF",
    inputBorder: "#E5E0D8",
    border: "#E8E2D8",
    borderStrong: "#D5CDC0",
    textPrimary: "#14120E",
    textSecondary: "#635C50",
    textMuted: "#8E8677",
    accent: "#E84D25",
    accentHover: "#D43F18",
    accentText: "#FFFFFF",
    accentSoft: "rgba(232, 77, 37, 0.08)",
    accentGlow: "rgba(232, 77, 37, 0.22)",
    speaking: "#1FA66A",
    online: "#2E9E4F",
    idle: "#D99A10",
    dnd: "#D93A3A",
    danger: "#D93A3A",
    dangerSoft: "rgba(217, 58, 58, 0.10)",
    info: "#2F6FA8",
  },
};

export const fonts = {
  display: "Bricolage Grotesque, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
  body: "Instrument Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
  mono: "JetBrains Mono, monospace",
};

export const fontSizes = {
  xs: "0.75rem", // 12px
  sm: "0.875rem", // 14px
  base: "1rem", // 16px
  lg: "1.125rem", // 18px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
};

export const radii = {
  xs: "4px",
  sm: "8px",
  md: "14px",
  lg: "24px",
  full: "9999px",
};

export const spacing = {
  1: "0.25rem", // 4px
  2: "0.5rem", // 8px
  3: "0.75rem", // 12px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  8: "2rem", // 32px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
};

export default {
  colors,
  fonts,
  fontSizes,
  radii,
  spacing,
};

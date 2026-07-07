import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { light, dark, colors, radii, shadows } from './theme';
import { useAuthStore } from './stores/authStore';
import { api } from './utils/api';

const ThemeContext = createContext();

function hexToRgba(hex, alpha) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((c) => parseInt(c, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('restolab-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [businessColors, setBusinessColors] = useState({ primaryColor: null, secondaryColor: null });

  const isDark = mode === 'dark';
  const businessId = useAuthStore((s) => s.user?.businessId);

  useEffect(() => {
    if (!businessId) {
      setBusinessColors({ primaryColor: null, secondaryColor: null });
      return;
    }
    api.get('/auth/business/branding')
      .then((data) => setBusinessColors({ primaryColor: data.primaryColor, secondaryColor: data.secondaryColor }))
      .catch(() => {});
  }, [businessId]);

  const applyBusinessColors = (colors) => setBusinessColors(colors);

  const t = useMemo(() => {
    const base = isDark ? dark : light;
    const { primaryColor, secondaryColor } = businessColors;
    if (!primaryColor) return { ...base, secondary: secondaryColor || base.accent };
    return {
      ...base,
      accent: primaryColor,
      accentBg: hexToRgba(primaryColor, isDark ? 0.18 : 0.10) || base.accentBg,
      secondary: secondaryColor || primaryColor,
    };
  }, [isDark, businessColors]);

  useEffect(() => {
    localStorage.setItem('restolab-theme', mode);
    document.documentElement.classList.toggle('dark', isDark);

    const root = document.documentElement.style;
    root.setProperty('--theme-bg', t.bg);
    root.setProperty('--theme-card', t.cardBg);
    root.setProperty('--theme-text1', t.text1);
    root.setProperty('--theme-text2', t.text2);
    root.setProperty('--theme-text3', t.text3);
    root.setProperty('--theme-accent', t.accent);
    root.setProperty('--theme-accent-bg', t.accentBg);
    root.setProperty('--theme-secondary', t.secondary);
    root.setProperty('--theme-border', t.border);
    root.setProperty('--theme-tab-bg', t.tabBg);
    root.setProperty('--theme-tab-active', t.tabActive);
    root.setProperty('--theme-nav-bg', t.navBg);
    root.setProperty('--theme-green-bg', t.greenBg);
    root.setProperty('--theme-green-text', t.greenText);
    root.setProperty('--theme-orange-bg', t.orangeBg);
    root.setProperty('--theme-orange-text', t.orangeText);
    root.setProperty('--theme-blue-bg', t.blueBg);
    root.setProperty('--theme-blue-text', t.blueText);

    Object.entries(radii).forEach(([k, v]) => root.setProperty(`--radius-${k}`, v));
    root.setProperty('--shadow-card', shadows.card);
    root.setProperty('--shadow-cta', shadows.cta);
  }, [mode, isDark, t]);

  const toggleTheme = () => setMode(m => m === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ mode, isDark, t, colors, radii, shadows, toggleTheme, applyBusinessColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

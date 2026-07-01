import { createContext, useContext, useState, useEffect } from 'react';
import { light, dark, colors, radii, shadows } from './theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('foodly-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const isDark = mode === 'dark';
  const t = isDark ? dark : light;

  useEffect(() => {
    localStorage.setItem('foodly-theme', mode);
    document.documentElement.classList.toggle('dark', isDark);

    const root = document.documentElement.style;
    root.setProperty('--theme-bg', t.bg);
    root.setProperty('--theme-card', t.cardBg);
    root.setProperty('--theme-text1', t.text1);
    root.setProperty('--theme-text2', t.text2);
    root.setProperty('--theme-text3', t.text3);
    root.setProperty('--theme-accent', t.accent);
    root.setProperty('--theme-accent-bg', t.accentBg);
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
    <ThemeContext.Provider value={{ mode, isDark, t, colors, radii, shadows, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

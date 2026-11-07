import { useCallback, useEffect, useState } from 'react';

const KEY = 'ph-theme';
const ORDER = ['system', 'light', 'dark'];

const read = () => {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
};

/** light / dark / system, applied as a class on <html> and remembered per browser. */
export function useTheme() {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private window: the choice simply does not persist */
    }
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const cycleTheme = useCallback(() => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]), []);
  return { theme, setTheme, cycleTheme };
}

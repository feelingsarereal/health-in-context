import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
interface ThemeCtx { theme: Theme; toggle: () => void; reducedMotion: boolean }

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {}, reducedMotion: false });

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('bx-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const h = () => setReducedMotion(mq.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);
  // Persist only an explicit choice, so "Clear my data" leaves nothing behind until the person chooses again.
  const toggle = useCallback(
    () =>
      setTheme((t) => {
        const next = t === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('bx-theme', next); } catch { /* ignore */ }
        return next;
      }),
    [],
  );
  const value = useMemo(() => ({ theme, toggle, reducedMotion }), [theme, toggle, reducedMotion]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

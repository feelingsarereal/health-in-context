import { useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTheme, manifest, S, C } from '@feelingsarereal/sdoh-loops-core';
import { ClearData } from './ui/ClearData';
import { FirstRun } from './ui/FirstRun';
import { PrototypeBanner } from './ui/PrototypeBanner';

const NAV: [string, string][] = [
  ['/map', C.nav.map],
  ['/maps', C.nav.maps],
  ['/evidence', C.nav.evidence],
  ['/references', C.nav.references],
  ['/glossary', C.nav.glossary],
  ['/concepts', C.nav.concepts],
  ['/help', C.nav.help],
  ['/methods', C.nav.methods],
  ['/about', C.nav.about],
];

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const [first, second] = manifest.short_title.split(' ');
  const wide = loc.pathname.startsWith('/map');
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 bx-btn">
        {C.skip}
      </a>
      <PrototypeBanner />
      <header className="sticky top-0 z-40 border-b border-[color:var(--bx-line)] bg-paper/90 dark:bg-night/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link to="/" className="font-display text-xl font-semibold whitespace-nowrap">
            {first} <span className="bx-muted font-normal">{second}</span>
          </Link>
          <nav aria-label="Main" className="hidden lg:flex flex-1 flex-wrap items-center gap-0.5">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/map' ? false : undefined} className={({ isActive }) => `rounded-md px-2.5 py-1.5 text-sm ${isActive ? 'font-semibold underline underline-offset-4' : ''}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" className="bx-btn ax-tap justify-center" onClick={toggle} aria-label={theme === 'dark' ? C.theme.light : C.theme.dark} data-testid="theme-toggle" aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button type="button" className="bx-btn ax-tap justify-center lg:hidden" aria-expanded={menu} aria-controls="mobile-nav" onClick={() => setMenu((m) => !m)}>
              Menu
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" aria-label="Main" className="lg:hidden border-t border-[color:var(--bx-line)] px-4 py-2">
            <ul className="grid grid-cols-2 gap-1">
              {NAV.map(([to, label]) => (
                <li key={to}>
                  <NavLink to={to} onClick={() => setMenu(false)} className={({ isActive }) => `ax-tap flex items-center rounded-md px-2.5 py-1.5 text-sm ${isActive ? 'font-semibold underline underline-offset-4' : ''}`}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1} className={`flex-1 w-full mx-auto ${wide ? 'max-w-[100rem] px-2 sm:px-4 py-3' : 'max-w-3xl px-4 py-8'}`}>
        {!wide && loc.pathname !== '/' && <FirstRun />}
        {children}
      </main>
      <footer className="border-t border-[color:var(--bx-line)] no-print">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm bx-muted">
          <p className="flex-1 min-w-[16rem]">
            {C.footer} {S.privacy.saved_here}
          </p>
          <Link to="/methods" className="underline">{C.nav.methods}</Link>
          <Link to="/about" className="underline">{C.nav.about}</Link>
          <Link to="/help" className="underline">{C.nav.help}</Link>
          <ClearData />
          {/* SL32 (T-LIC-01): WHO's required citation, verbatim (§1.3), on every page — one line of the footer's own row,
              so the footer stays inside the share of the window the map's viewport fit allows (SL31) */}
          <p className="basis-full text-xs leading-4" data-testid="footer-who-citation">{S.codes.who_citation}</p>
        </div>
      </footer>
    </div>
  );
}

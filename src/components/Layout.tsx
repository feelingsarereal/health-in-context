import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTheme, S, C } from '@feelingsarereal/sdoh-loops-core';
import { brand, BS } from '@/lib/brand';
import { LofLogo } from './ui/LofLogo';
import { ClearData } from './ui/ClearData';
import { FirstRun } from './ui/FirstRun';
import { PrototypeBanner } from './ui/PrototypeBanner';

const PRIMARY: [string, string][] = [
  ['/map', C.nav.map],
  ['/maps', C.nav.maps],
  ['/evidence', C.nav.evidence],
  ['/references', C.nav.references],
  ['/glossary', C.nav.glossary],
  ['/concepts', C.nav.concepts],
  ['/help', C.nav.help],
  ['/methods', C.nav.methods],
];
const MORE: [string, string][] = [['/about', C.nav.about]];

const navCls = ({ isActive }: { isActive: boolean }) =>
  `ax-tap inline-flex items-center rounded-md px-2 py-1 text-[15px] font-semibold whitespace-nowrap no-underline hover:bg-paper-2 dark:hover:bg-night-2 ${isActive ? 'underline underline-offset-4 decoration-2' : ''}`;
const inkLink = { color: 'var(--bx-ink)' };

/** SL39: the Alabama app's More menu */
function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button ref={btn} type="button" className="ax-tap rounded-md px-2 py-1 text-[15px] font-semibold hover:bg-paper-2 dark:hover:bg-night-2" aria-expanded={open} aria-controls="more-nav" onClick={() => setOpen((o) => !o)} data-testid="more-menu">
        More <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul id="more-nav" className="bx-card absolute left-0 z-50 mt-1 w-44 p-1 text-sm bg-[color:var(--bx-bg)] dark:bg-night-2">
          {MORE.map(([to, label]) => (
            <li key={to}>
              <NavLink to={to} className="ax-tap block rounded px-2 py-1.5 no-underline hover:bg-paper-2 dark:hover:bg-night" style={inkLink}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const wide = loc.pathname.startsWith('/map');
  useEffect(() => setMenu(false), [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 bx-btn">
        {C.skip}
      </a>
      <PrototypeBanner />
      <header className="sticky top-0 z-40 bg-white dark:bg-night no-print" data-testid="site-header">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link to="/" className="flex min-w-0 items-center gap-2 no-underline" aria-label={BS.brand.home_label} data-testid="home-link">
            <img src={`${import.meta.env.BASE_URL}brand/health-in-context-mark.svg`} alt="" aria-hidden="true" height={34} style={{ height: 34, width: 'auto' }} data-testid="brand-mark" />
            <span className="block leading-tight">
              <span className="block font-display text-[17px] font-bold text-ink dark:text-night-ink" data-testid="wordmark">{BS.brand.name}</span>
              <span className="block text-[13px] italic bx-muted" aria-hidden="true" data-testid="wordmark-line-2">{BS.brand.header_line_2}</span>
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button type="button" className="bx-btn ax-tap justify-center" onClick={toggle} aria-label={theme === 'dark' ? C.theme.light : C.theme.dark} data-testid="theme-toggle" aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button type="button" className="bx-btn ax-tap justify-center lg:hidden" aria-expanded={menu} aria-controls="mobile-nav" onClick={() => setMenu((m) => !m)}>
              Menu
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="hidden lg:block border-t border-[color:var(--bx-line-soft)]">
          <div className="mx-auto flex max-w-7xl items-center gap-0.5 px-3 py-0.5">
            {PRIMARY.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/map' ? false : undefined} className={navCls} style={inkLink}>
                {label}
              </NavLink>
            ))}
            <MoreMenu />
          </div>
        </nav>
        {menu && (
          <nav id="mobile-nav" aria-label="Main" className="lg:hidden border-t border-[color:var(--bx-line-soft)] px-4 py-2">
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {[...PRIMARY, ...MORE].map(([to, label]) => (
                <li key={to}>
                  <NavLink to={to} onClick={() => setMenu(false)} className={navCls} style={inkLink}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="h-0.5" style={{ background: 'var(--bx-rule)' }} data-testid="header-rule" />
      </header>
      <main id="main" tabIndex={-1} className={`flex-1 min-h-[100vh] w-full mx-auto ${wide ? 'max-w-[100rem] px-2 sm:px-4 py-3' : 'max-w-3xl px-4 py-8'}`}>
        {!wide && loc.pathname !== '/' && <FirstRun />}
        {children}
      </main>
      <footer className="no-print border-t-2" style={{ borderTopColor: 'var(--bx-rule)' }} data-testid="site-footer">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 text-sm md:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <div className="pb-3"><LofLogo alt={BS.brand.logo_alt} /></div>
            <p><strong>{brand.organisation}</strong></p>
            <p>{brand.org_descriptor}</p>
            <p>
              {brand.address} · <a className="underline" href={`mailto:${brand.email}`}>{brand.email}</a> · <a className="underline" href={brand.website} rel="noreferrer"><strong>{brand.website_label}</strong></a>
            </p>
            <p data-testid="footer-lockup">{BS.brand.footer_lockup}</p>
            <p className="bx-muted">{C.footer} {S.privacy.saved_here}</p>
            <p className="mt-2 text-center italic" style={{ color: 'var(--bx-accent)' }} data-testid="tagline">{brand.tagline}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2 md:flex-col md:items-start">
            <Link to="/about" className="underline">{C.nav.about}</Link>
            <Link to="/help" className="underline">{C.nav.help}</Link>
            <Link to="/methods" className="underline">{C.nav.methods}</Link>
            <ClearData />
          </nav>
        </div>
        {/* SL32 (T-LIC-01): WHO's required citation, verbatim (§1.3), on every page. SL39: on its own line, apart from the LOF block,
            so nothing reads as WHO endorsing LOF or the tool (§4.1) */}
        <div className="border-t border-[color:var(--bx-line-soft)]">
          <p className="mx-auto max-w-7xl px-4 py-3 text-xs leading-4 bx-muted" data-testid="footer-who-citation">{S.codes.who_citation}</p>
        </div>
      </footer>
    </div>
  );
}

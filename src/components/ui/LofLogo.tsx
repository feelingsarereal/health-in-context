const base = import.meta.env.BASE_URL;

/** SL39: the official LOF logo, one file per theme and switched by the app's own theme class, so the manual toggle wins. Never inverted or filtered. */
export function LofLogo({ alt }: { alt: string }) {
  return (
    <span data-testid="lof-logo">
      <img src={`${base}brand/lof-logo.svg`} alt={alt} height={48} style={{ height: 48, width: 'auto' }} className="block dark:hidden" data-testid="lof-logo-light" />
      <img src={`${base}brand/lof-logo-white.png`} alt={alt} height={48} style={{ height: 48, width: 'auto' }} className="hidden dark:block" data-testid="lof-logo-dark" />
    </span>
  );
}

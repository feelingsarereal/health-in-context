import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type ReactNode } from 'react';

export interface ToolItem {
  id: string;
  label: ReactNode;
  role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  checked?: boolean;
  disabled?: boolean;
  /** aria-keyshortcuts, as the button it replaces carried */
  shortcut?: string;
  /** what the row shows at its right edge, e.g. "R" */
  kbd?: string;
  title?: string;
  testId?: string;
  /** a real link (List view / Canvas view) */
  href?: string;
  onSelect: (e: RMouseEvent) => void;
}
export interface ToolSection {
  /** a heading, and the items in a named group (the Layout choices) */
  label?: string;
  /** a separator above this section */
  sep?: boolean;
  items: ToolItem[];
}

/**
 * SL35: a toolbar menu (Arrange, View, and the Do actions on a phone). A real `menu`, with the keys of the Map menu
 * (SL23): Enter, ↓ or ↑ on the button opens it; ↑ ↓ Home End move; Esc closes and gives focus back; Tab leaves.
 */
export function ToolMenu({ label, button, sections, testId, chip, ariaLabel }: { label: string; button: ReactNode; sections: ToolSection[]; testId: string; chip?: ReactNode; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusAt = useRef<'first' | 'last'>('first');
  const id = useId();
  const all = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? []);
  useEffect(() => {
    if (!open) return;
    const els = all();
    (focusAt.current === 'last' ? els[els.length - 1] : els[0])?.focus();
    focusAt.current = 'first';
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // kept on screen near the window's right edge (a phone)
  useLayoutEffect(() => {
    const m = menu.current;
    if (!open || !m) return;
    m.style.left = '0px';
    const over = m.getBoundingClientRect().right - (window.innerWidth - 8);
    if (over > 0) m.style.left = `${-over}px`;
  }, [open]);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };
  const onBtnKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  };
  const onMenuKey = (e: RKeyboardEvent) => {
    const els = all();
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => els[(j + els.length) % els.length]?.focus();
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(els.length - 1);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') return setOpen(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const row = (it: ToolItem) => {
    const props = {
      role: it.role ?? 'menuitem',
      'aria-checked': it.role && it.role !== 'menuitem' ? !!it.checked : undefined,
      'aria-disabled': it.disabled || undefined,
      'aria-keyshortcuts': it.shortcut,
      tabIndex: -1,
      title: it.title,
      'data-testid': it.testId,
      className: `ax-tap flex w-full items-center justify-between gap-3 rounded px-3 py-1.5 text-left text-sm hover:bg-paper-2 focus:bg-paper-2 dark:hover:bg-night dark:focus:bg-night ${it.disabled ? 'cursor-not-allowed opacity-60' : ''}`,
      onClick: (e: RMouseEvent) => {
        if (it.disabled) return e.preventDefault();
        close(!it.href);
        it.onSelect(e);
      },
    };
    const body = (
      <>
        <span>
          {it.role && it.role !== 'menuitem' && <span aria-hidden="true">{it.checked ? (it.role === 'menuitemradio' ? '● ' : '☑ ') : it.role === 'menuitemradio' ? '○ ' : '☐ '}</span>}
          {it.label}
        </span>
        {it.kbd && <span className="bx-kbd" aria-hidden="true">{it.kbd}</span>}
      </>
    );
    return it.href ? <a key={it.id} href={it.href} {...props}>{body}</a> : <button key={it.id} type="button" {...props}>{body}</button>;
  };
  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btn}
        type="button"
        className={`bx-btn ax-tap ${open ? 'bx-btn-on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onBtnKey}
        data-testid={testId}
      >
        {button} <span aria-hidden="true">▾</span>
        {chip}
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          className="bx-card absolute left-0 top-full z-40 mt-1 w-[min(18rem,calc(100vw-2rem))] p-1 shadow-lg bg-[color:var(--bx-bg)] dark:bg-night-2"
          onKeyDown={onMenuKey}
          data-testid={`${testId}-list`}
        >
          {sections.map((s, i) => (
            <div key={s.label ?? i} className="contents">
              {s.sep && <div role="separator" className="my-1 border-t border-[color:var(--bx-line)]" />}
              {s.label ? (
                <div role="group" aria-label={s.label}>
                  <p aria-hidden="true" className="px-3 pt-1 text-xs font-semibold bx-muted">{s.label}</p>
                  {s.items.map(row)}
                </div>
              ) : (
                s.items.map(row)
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

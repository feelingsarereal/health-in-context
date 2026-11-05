import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog> as a modal: focus is trapped, Esc closes, the trigger gets focus back. */
export function Dialog({ open, onClose, title, children, wide, testId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; testId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const back = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      back.current = document.activeElement;
      d.showModal();
      // the autofocus target takes focus a frame later — unless the user has already moved focus on from where
      // showModal put it
      const first = document.activeElement;
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (a && a !== first && a !== d && d.contains(a)) return;
        (d.querySelector('[data-autofocus]') as HTMLElement | null)?.focus();
      });
    } else if (!open && d.open) {
      d.close();
      (back.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-labelledby={testId ? `${testId}-title` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`bx-card m-auto w-[min(100vw-1rem,${wide ? '46rem' : '32rem'})] max-h-[90vh] overflow-y-auto p-0 text-[color:var(--bx-ink)] bg-[color:var(--bx-bg)] dark:bg-night-2`}
      style={{ width: `min(calc(100vw - 1rem), ${wide ? '46rem' : '32rem'})` }}
    >
      {open && (
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 id={testId ? `${testId}-title` : undefined} className="text-xl font-semibold">{title}</h2>
            <button type="button" className="bx-btn ax-tap justify-center" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

import { useState, type ReactNode } from 'react';
import { useFloating, useClick, useDismiss, useRole, useInteractions, FloatingFocusManager, offset, flip, shift, size, autoUpdate, FloatingPortal } from '@floating-ui/react';

/**
 * MI popover: anchored, Esc/outside click closes, focus managed, opens on click (and Enter/Space).
 *
 * Inside a modal <dialog> (showModal puts it in the browser's top layer and makes the rest of the page inert), the
 * popover portals into that dialog rather than into <body>, which no z-index can lift above the top layer
 * (K2 defect D1). `strategy: 'fixed'` keeps it placed against the viewport, so the dialog's own scroll neither offsets
 * nor clips it. In full screen (SL17) it portals into the full-screen element, for the same reason.
 */
export function Popover({ trigger, children, label, className }: { trigger: ReactNode; children: ReactNode; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<HTMLElement | undefined>(undefined);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (o) => {
      // SL17: in full screen only the full-screen element is drawn, so the popover portals into it
      if (o) setRoot((((refs.domReference.current as Element | null)?.closest('dialog') ?? document.fullscreenElement) as HTMLElement | null) ?? undefined);
      setOpen(o);
    },
    strategy: 'fixed',
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // never taller than the room left in the viewport; the popover scrolls inside instead
      size({ padding: 8, apply: ({ availableHeight, elements }) => { elements.floating.style.maxHeight = `${Math.max(160, availableHeight)}px`; } }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([useClick(context), useDismiss(context), useRole(context, { role: 'dialog' })]);
  return (
    <>
      <button type="button" ref={refs.setReference} className={className} aria-label={label} {...getReferenceProps()}>
        {trigger}
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager context={context} modal={false}>
            <div ref={refs.setFloating} style={floatingStyles} className="bx-card z-50 max-w-sm overflow-y-auto p-3 text-sm bg-[color:var(--bx-bg)] dark:bg-night-2" data-testid="popover" {...getFloatingProps()}>
              {children}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

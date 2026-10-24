import { useState, type ReactNode } from 'react';
import { useFloating, useClick, useDismiss, useRole, useInteractions, FloatingFocusManager, offset, flip, shift, autoUpdate, FloatingPortal } from '@floating-ui/react';

/** MI popover: anchored, Esc/outside click closes, focus managed, opens on click (and Enter/Space). */
export function Popover({ trigger, children, label, className }: { trigger: ReactNode; children: ReactNode; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({ open, onOpenChange: setOpen, middleware: [offset(6), flip(), shift({ padding: 8 })], whileElementsMounted: autoUpdate });
  const { getReferenceProps, getFloatingProps } = useInteractions([useClick(context), useDismiss(context), useRole(context, { role: 'dialog' })]);
  return (
    <>
      <button type="button" ref={refs.setReference} className={className} aria-label={label} {...getReferenceProps()}>
        {trigger}
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div ref={refs.setFloating} style={floatingStyles} className="bx-card z-50 max-w-sm p-3 text-sm bg-[color:var(--bx-bg)] dark:bg-night-2" {...getFloatingProps()}>
              {children}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

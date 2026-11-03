import { useState } from 'react';
import { S, getStore, resetStore, Dialog } from '@feelingsarereal/sdoh-loops-core';

/** SAFETY H4: one visible control that deletes everything the app stored on this device, after a confirm. */
export function ClearData({ className = 'bx-btn' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={`${className} ax-tap`} onClick={() => setOpen(true)} data-testid="clear-data">
        {S.privacy.clear}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={S.privacy.clear} testId="clear-dialog">
        <p className="mb-4">{S.privacy.clear_confirm}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bx-btn-primary ax-tap"
            disabled={busy}
            data-testid="clear-confirm"
            onClick={async () => {
              setBusy(true);
              const store = await getStore();
              await store.clearAll();
              resetStore();
              window.dispatchEvent(new Event('sdoh-cleared'));
              setBusy(false);
              setOpen(false);
              window.location.assign(import.meta.env.BASE_URL);
            }}
          >
            Delete everything
          </button>
          <button type="button" className="bx-btn ax-tap" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </>
  );
}

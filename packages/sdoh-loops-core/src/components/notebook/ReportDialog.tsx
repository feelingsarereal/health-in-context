import { useId, useState } from 'react';
import { C } from '../../lib/copy';
import { Dialog } from '../ui/Dialog';
import type { ReportOptions } from '../../lib/model/report';

// (the report itself loads on first export; only its options' type is needed here)
const REPORT_DEFAULTS: ReportOptions = { notes: true, image: true, annotations: true };

export type ReportFormat = 'print' | 'html' | 'md' | 'docx';
export interface ReportChoice {
  format: ReportFormat;
  options: ReportOptions;
}
const FORMATS: ReportFormat[] = ['print', 'html', 'md', 'docx'];

/** SL28 point 4: Export report… — the format, and what to include. The identifier warning follows, as for every export. */
export function ReportDialog({ open, onClose, onExport, canImage }: { open: boolean; onClose: () => void; onExport: (c: ReportChoice) => void; canImage: boolean }) {
  const uid = useId().replace(/:/g, '');
  const [format, setFormat] = useState<ReportFormat>('print');
  const [o, setO] = useState<ReportOptions>(REPORT_DEFAULTS);
  const K = C.notebook.caseFile;
  const box = (k: keyof ReportOptions, label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ax-tap ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" checked={o[k] && !disabled} disabled={disabled} onChange={(e) => setO((x) => ({ ...x, [k]: e.target.checked }))} data-testid={`report-opt-${k}`} />
      {label}
    </label>
  );
  return (
    <Dialog open={open} onClose={onClose} title={K.reportTitle} testId="report-dialog">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onExport({ format, options: { ...o, image: o.image && canImage } });
        }}
      >
        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-semibold">{K.format}</legend>
          {FORMATS.map((f, i) => (
            <label key={f} className="flex items-center gap-2 text-sm ax-tap">
              <input type="radio" name={`${uid}-f`} value={f} checked={format === f} onChange={() => setFormat(f)} data-testid={`report-format-${f}`} {...(i === 0 ? { 'data-autofocus': true } : {})} />
              {K.formats[f]}
            </label>
          ))}
        </fieldset>
        <fieldset className="mb-3 space-y-1">
          <legend className="mb-1 text-sm font-semibold">{K.include}</legend>
          {box('notes', K.notes)}
          {box('image', K.image, !canImage)}
          {!canImage && <p className="m-0 text-xs bx-muted">{K.noImage}</p>}
          {box('annotations', K.annotations)}
        </fieldset>
        <p className="mb-3 text-xs bx-muted">{K.heuristicHint}</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="bx-btn-primary ax-tap" data-testid="report-go">{K.go}</button>
          <button type="button" className="bx-btn ax-tap" onClick={onClose}>{K.cancel}</button>
        </div>
      </form>
    </Dialog>
  );
}

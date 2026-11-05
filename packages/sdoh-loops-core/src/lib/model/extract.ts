/**
 * SL27: the extension point for assisted extraction (S7.1, S7.2). An extractor reads one note and returns proposals in
 * the SDOH-EXTRACTION record shape; the notebook lists them in a queue, and nothing is applied without the user's click.
 * Everything accepted keeps its extractor's label in the map file ("suggested by: Local code matcher").
 *
 * The refusal rule: a `remote` extractor (one that would send text off the device) runs only when the host passes
 * `allowRemoteExtractors` AND the note has no unresolved identifier flags. The health profile keeps it off in every app
 * until a SAFETY ruling (S7.2); the core's own extractor is local.
 */
import type { OtherType } from './map';
import type { Polarity } from '../analysis';
import { fieldText, type Note, type SuggestedBy } from './notebook';
import { findIdentifiers } from './identifiers';
import { suggestCodes } from './suggest';

/** One proposed circumstance, as an SDOH-EXTRACTION record (code or other_type; explicit or implicit with a rationale). */
export interface Proposal {
  id: string;
  extractor: SuggestedBy;
  label: string;
  code: string | null;
  other_type: OtherType | null;
  status: 'explicit' | 'implicit';
  /** required when implicit: what the marker is and what it does not say */
  rationale: string | null;
  confidence: 'high' | 'medium' | 'low';
  /** at least one; each quote verbatim in the note */
  spans: { where: string; quote: string; prefix: string; suffix: string }[];
  /** proposed links to other proposals (by id) or to circumstances on the map (by node id); the evidence check runs on accept */
  links: { to: string; polarity: Polarity; weight: number; basis: 'evidence' | 'transcript' }[];
}
export interface ExtractContext {
  /** the map's circumstances, for links to existing ones */
  nodes: { id: string; code: string | null; label: string }[];
}
export interface NotebookExtractor {
  id: string;
  label: string;
  kind: 'local' | 'remote';
  /** one line on what it does and where the text goes */
  describe: string;
  run(note: Note, context: ExtractContext): Promise<Proposal[]>;
}

/** The refusal rule, before any extractor runs. */
export function mayRun(ex: Pick<NotebookExtractor, 'kind'>, opts: { allowRemote?: boolean; flags: number }): { ok: true } | { ok: false; reason: 'remote-off' | 'flags' } {
  if (ex.kind !== 'remote') return { ok: true };
  if (!opts.allowRemote) return { ok: false, reason: 'remote-off' };
  if (opts.flags > 0) return { ok: false, reason: 'flags' };
  return { ok: true };
}
/** Run an extractor on a note under the refusal rule; refused, it is never called. */
export async function runExtractor(ex: NotebookExtractor, note: Note, ctx: ExtractContext, opts: { allowRemote?: boolean; flags: number }): Promise<Proposal[]> {
  const r = mayRun(ex, opts);
  if (!r.ok) throw new RefusedError(r.reason);
  const out = await ex.run(note, ctx);
  // the label always says who suggested it, whatever the extractor returned
  return out.map((p) => ({ ...p, extractor: { extractor: ex.id, label: ex.label } }));
}
export class RefusedError extends Error {
  constructor(public reason: 'remote-off' | 'flags') {
    super(reason === 'remote-off' ? 'This extractor sends text off the device, and this app does not allow that.' : 'This note still has possible identifiers. Label or dismiss them first.');
  }
}

const CONTEXT = 32;
/** Sentences of a text with their offsets (a line break also ends one). */
function sentences(t: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const lead = m[0].length - m[0].trimStart().length;
    const s = m[0].trim();
    if (s.length >= 3) out.push({ start: m.index + lead, end: m.index + lead + s.length });
  }
  return out;
}

/**
 * SL27: the core's local extractor — the code suggester over a whole note, sentence by sentence, one proposal per code
 * (its clearest sentence, up to three). Explicit when the sentence holds a WHO title or index term whole; otherwise
 * implicit, with a rationale naming the words that matched. Chapter 24 only; no links (it does not read relations).
 */
export const localCodeMatcher: NotebookExtractor = {
  id: 'local-code-matcher',
  label: 'Local code matcher',
  kind: 'local',
  describe: 'Matches each sentence against the WHO titles, index terms and search aliases in this app, on this device.',
  async run(note) {
    const fields = note.kind === 'structured' ? (note.fields ?? []).filter((f) => f.key !== 'date').map((f) => f.key) : ['body'];
    const byCode = new Map<string, { p: Proposal; score: number }>();
    for (const where of fields) {
      const text = fieldText(note, where);
      for (const s of sentences(text)) {
        const quote = text.slice(s.start, s.end);
        // a sentence with a possible identifier is still offered; its quote is the user's own text, on the device
        const top = suggestCodes(quote, 1)[0];
        if (!top || top.score < 1.5) continue;
        const whole = top.viaKind !== 'alias' && quote.toLowerCase().includes(top.via.toLowerCase());
        const status: Proposal['status'] = whole ? 'explicit' : 'implicit';
        const span = { where, quote, prefix: text.slice(Math.max(0, s.start - CONTEXT), s.start), suffix: text.slice(s.end, s.end + CONTEXT) };
        const prev = byCode.get(top.code);
        if (prev) {
          if (prev.p.spans.length < 3) prev.p.spans.push(span);
          continue;
        }
        byCode.set(top.code, {
          score: top.score,
          p: {
            id: `prop-${top.code}-${where}-${s.start}`,
            extractor: { extractor: 'local-code-matcher', label: 'Local code matcher' },
            label: top.title,
            code: top.code,
            other_type: null,
            status,
            rationale: whole ? null : `The words “${top.words.join(' ')}” match “${top.via}” in WHO's text; the note does not name the circumstance in those words.`,
            confidence: whole ? 'high' : top.score >= 3 ? 'medium' : 'low',
            spans: [span],
            links: [],
          },
        });
      }
    }
    return [...byCode.values()].sort((a, b) => b.score - a.score).map((x) => x.p);
  },
};

/** How many possible identifiers a note has now (for the refusal rule), counting its title and every field. */
export function noteFlagCount(note: Note, isDismissed: (c: string, v: string) => boolean): number {
  const texts = [note.title, ...note.tags, fieldText(note, 'body'), ...(note.fields ?? []).map((f) => (f.key === 'date' ? f.value ?? '' : fieldText(note, f.key)))];
  return texts.reduce((n, t) => n + findIdentifiers(t).filter((h) => !isDismissed(h.category, h.value)).length, 0);
}

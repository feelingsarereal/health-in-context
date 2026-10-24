/** Small, always-loaded data: identity, safety, strings, provenance. Heavy data lives in scheme.ts / refs.ts. */
import manifestJson from '@/data/manifest.json';
import stringsJson from '@/data/strings.json';
import provenanceJson from '@/data/provenance.json';
import stalenessJson from '@/data/staleness.json';
import buildErrorsJson from '@/data/build-errors.json';

export interface HelpEntry { name: string; how: string; url?: string; source: string; verified_on: string; recheck_days?: number }
export const bundle = manifestJson as any;
export const manifest = bundle.manifest as {
  slug: string; title: string; short_title: string; kind: string; safety_profile: string; question: string; as_of: string;
  authors: string[]; venue: string; delivery: string; storage: string; github_account: string;
  builder: { name: string; version: string; date: string }; permissions: { text: string; figures: string };
};
export const safety = bundle.safety as { profile: string; notice: string; blocked_phrases: string[]; allowed_contexts: { field: string }[]; deidentify: { fields: string[]; nudge: string }; help: HelpEntry[] };
export const S = stringsJson as any;
export const provenance = provenanceJson as any;
export const staleness = stalenessJson as any;
export const buildErrors = buildErrorsJson as { errors: string[]; warnings: string[] };
export const NUDGE: string = safety.deidentify.nudge;
export const DEIDENTIFY_FIELDS = new Set(safety.deidentify.fields);

/** Days since a YYYY-MM-DD date, measured from now (runtime staleness for /help). */
export function ageDays(date: string, today = new Date()): number {
  return Math.floor((today.getTime() - Date.parse(date + 'T00:00:00Z')) / 86_400_000);
}

/** This app's own build facts (scripts/build-content.ts): provenance, staleness and build errors. The pack's data is in sdoh-loops-core. */
import provenanceJson from '@/data/provenance.json';
import stalenessJson from '@/data/staleness.json';
import buildErrorsJson from '@/data/build-errors.json';

export const provenance = provenanceJson as any;
export const staleness = stalenessJson as any;
export const buildErrors = buildErrorsJson as { errors: string[]; warnings: string[] };

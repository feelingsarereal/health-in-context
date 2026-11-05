/**
 * SL32 (T-LIC-01): the ICD-10-CM crosswalk switch at runtime.
 *
 * `<SdohMap crosswalk={false}>` hides the ICD-10-CM half of the crosswalk wherever the map shows a code (the code card,
 * the peek, the code picker's detail, the notebook's code view); the Healthy People 2030 half stays as the builder's
 * topic tag. A build with VITE_SDOH_XWALK=off (the `sdohCrosswalk({ crosswalk: false })` Vite plugin sets it) also
 * compiles that code out and leaves the pack's ICD-10-CM data out of the bundle, so nothing in the output pairs an
 * ICD-11 code with an ICD-10-CM one. Write the check as `XWALK_BUILD && …` inline — a literal the minifier folds.
 */
import { createContext, useContext } from 'react';

/** false in a build with VITE_SDOH_XWALK=off; true otherwise (also in tests and in a host without the plugin) */
export const XWALK_BUILD: boolean = import.meta.env.VITE_SDOH_XWALK !== 'off';

export const CrosswalkContext = createContext<boolean>(true);
/** whether this map shows the ICD-10-CM crosswalk: the `crosswalk` prop, and the build switch */
export const useCrosswalk = () => useContext(CrosswalkContext) && XWALK_BUILD;

/** the pack's crosswalk markers removed, for a host that does not run the Vite plugin */
export const unmarkXwalk = (s: string) => s.replace(/<!-- \/?xwalk -->\n?/g, '');

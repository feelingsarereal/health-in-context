import { useEffect, useState } from 'react';

const COARSE = '(pointer: coarse)';

/** True on a touch screen (no fine pointer): double-click and keys are not how people work there (K4 D10). */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.(COARSE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(COARSE);
    if (!mq) return;
    const on = () => setCoarse(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}

const NARROW = '(max-width: 767px)';

/** True under 768 px wide (a phone): the loop glyphs scale with the canvas zoom there, as the boxes do (K14). */
export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

const WIDE = '(min-width: 1024px)';

/** True from the lg breakpoint up, where the side dock sits beside the canvas and can collapse to a rail (SL17). */
export function useWideViewport(): boolean {
  const [wide, setWide] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

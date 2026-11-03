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

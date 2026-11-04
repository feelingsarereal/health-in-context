/**
 * K13 consumer fixture, entry. SL21: the first chunk imports only the core's light /theme entry (ThemeProvider and the
 * styles, no pack data); the map — and with it the pack — loads lazily, as an SDOH Interrogator app's map route will.
 * tests/consumer/sl20-sl23.spec.ts checks the built first chunk carries no situations or references data.
 */
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@feelingsarereal/sdoh-loops-core/theme';

const Fixture = lazy(() => import('./Fixture'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Suspense fallback={<p role="status">Loading the map…</p>}>
        <Fixture />
      </Suspense>
    </ThemeProvider>
  </StrictMode>,
);

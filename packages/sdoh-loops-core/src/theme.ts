/**
 * SL21: the light entry, `@feelingsarereal/sdoh-loops-core/theme` — ThemeProvider, the theme hook and the core's
 * styles, with no import of the pack data. An app's shell (every page) imports only this; the root entry, which
 * carries the pack (situations, references, links), is imported only where the map is, behind a lazy route.
 */
import './styles.css';

export { ThemeProvider, useTheme } from './lib/theme';
export type { Theme } from './lib/theme';

/**
 * @feelingsarereal/sdoh-loops-core — the SDOH Loops map as a package (K13). The standalone SDOH Loops app is its first
 * consumer; every SDOH Interrogator app embeds the same <SdohMap>. See README.md for the contract.
 */
// the component, its storage adapters and the pack pin
export { SdohMap, PANELS, type SdohMapProps, type Panel, type MapView, type Selection, type SideCard, type PeekTarget } from './SdohMap';
export { browserStore, getStore, resetStore, withOriginals, idbStore, localStore, pref, setPref, viewPref, setViewPref, ReadOnlyMapError, SLUG, DB_NAME, PREF_KEYS, type MapStore, type MapSummary } from './lib/storage';
export { nodeTextParts, nodeLines, type NodeTextParts } from './components/map/nodeText';
export { peekFacts } from './components/map/Peek';
export { loadedPack, pinMismatch, type PackPin } from './lib/data/pack';
export { ThemeProvider, useTheme } from './lib/theme';

// the pure analyses (A1–A8) and the map model
export * from './lib/analysis';
export * from './lib/model/map';
// the component takes the name SdohMap; the map document type is also exported as SdohMapDoc
export type { SdohMap as SdohMapDoc } from './lib/model/map';
export * from './lib/model/rich';
export * from './lib/model/interchange';
export * from './lib/model/evidence';
export { importFile } from './lib/model/importFile';

// the pinned pack's data, the interface copy and the shared UI pieces the standalone app's pages use too
export * from './lib/data/core';
export * from './lib/data/scheme';
export * from './lib/data/refs';
export { C, overlay } from './lib/copy';
export * from './lib/palette';
export { count } from './lib/plural';
export { useCoarsePointer } from './lib/pointer';
export * from './components/ui/bits';
export { Dialog } from './components/ui/Dialog';
export { Popover } from './components/ui/Popover';
export { CitedText } from './components/evidence/CitedText';
export { RefCard } from './components/evidence/RefCard';

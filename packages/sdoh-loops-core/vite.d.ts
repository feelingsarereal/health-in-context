import type { Plugin } from 'vite';
export declare const sdohCoreAlias: Record<string, string>;
export declare const sdohCoreContent: string[];
/** @deprecated SL33 (0.11.0): nothing reads the switch any more */
export declare function xwalkOn(env: string | undefined): boolean;
/** @deprecated SL33 (0.11.0): a no-op that logs one deprecation line; pack 0.4.0 carries no crosswalk to switch off */
export declare function sdohCrosswalk(opts?: { crosswalk?: boolean }): Plugin;

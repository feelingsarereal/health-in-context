import type { Plugin } from 'vite';
export declare const sdohCoreAlias: Record<string, string>;
export declare const sdohCoreContent: string[];
/** SL32: whether an env value (e.g. process.env.VITE_SDOH_XWALK) leaves the crosswalk on — off for 'off', 'false', '0' */
export declare function xwalkOn(env: string | undefined): boolean;
/** SL32: the crosswalk switch for the pack's data and the core's code; pass the same value as `<SdohMap crosswalk>` */
export declare function sdohCrosswalk(opts?: { crosswalk?: boolean }): Plugin;

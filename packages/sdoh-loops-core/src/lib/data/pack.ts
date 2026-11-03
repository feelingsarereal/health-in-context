/**
 * The pack loader's pin (K13). The core reads the content pack from @feelingsarereal/sdoh-loops-pack, a versioned asset
 * of its own; pin.json names the version and a SHA-256 of its data files. A consumer imports that same pin.json and
 * hands it to <SdohMap pack>, which refuses to open a map when the pack the bundle resolved is not the one pinned.
 */
import pinJson from '@feelingsarereal/sdoh-loops-pack/pin.json';

export interface PackPin {
  pack: string;
  version: string;
  as_of: string;
  sha256: string;
}
export const loadedPack = pinJson as PackPin;

/** Why `pin` is not the pack this bundle loaded, or null when it is. */
export function pinMismatch(pin: PackPin | null | undefined): string | null {
  if (!pin) return 'No content pack was pinned.';
  if (pin.pack !== loadedPack.pack) return `Pinned pack ${pin.pack}, but ${loadedPack.pack} is loaded.`;
  if (pin.version !== loadedPack.version || pin.sha256 !== loadedPack.sha256)
    return `Pinned ${pin.pack} ${pin.version}, but ${loadedPack.version} (${loadedPack.sha256.slice(0, 12)}) is loaded.`;
  return null;
}

import { manifest, S } from '@feelingsarereal/sdoh-loops-core';

/** SL39: manifest.brand, from the pack (source/pack-src/brand/brand.yaml). */
export interface Brand {
  organisation: string;
  org_descriptor: string;
  address: string;
  email: string;
  website: string;
  website_label: string;
  tagline: string;
}
export const brand = (manifest as unknown as { brand: Brand }).brand;

/** SL38/SL39's interface strings */
export interface BrandStrings {
  brand: { name: string; lockup: string; header_line_2: string; footer_lockup: string; home_label: string; logo_alt: string };
  about: { lead: string; program: string; short_titles_note: string };
}
export const BS = S as unknown as BrandStrings;

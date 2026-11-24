/**
 * The largest picture a logo can be cut out of. What is uploaded is the small square
 * the seller cut, so it is far below this.
 */
export const logoMaxBytes = 10 * 1024 * 1024;

/** The formats the API takes a photo in. */
export const logoFormats = 'image/jpeg,image/png,image/webp';

/** An uploaded logo: the id the store is saved with and the address it is shown from. */
export interface StoreLogo {
  readonly imageId: string;
  readonly url: string;
}
